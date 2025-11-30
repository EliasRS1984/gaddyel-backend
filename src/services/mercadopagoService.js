/**
 * Service: Mercado Pago
 * Descripción: Servicio para integración completa con Mercado Pago
 * Propósito: Crear preferencias, procesar webhooks, validar pagos
 */

const mercadopago = require('mercadopago');
const crypto = require('crypto');
const { logAudit, logWebhook, logSecurity } = require('../utils/logger');

// Configurar Mercado Pago
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

class MercadoPagoService {
  /**
   * Crear preferencia de pago (initiate checkout)
   * @param {Object} orderData - Datos de la orden
   * @returns {Object} - Preference ID y checkout URL
   */
  static async createPreference(orderData) {
    try {
      const {
        orderId,
        orderNumber,
        total,
        items,
        customer,
        notificationUrl,
      } = orderData;

      // Mapear items para Mercado Pago
      const mpItems = items.map(item => ({
        id: item.product.toString(),
        title: item.productName || 'Producto',
        description: item.productName || '',
        quantity: item.quantity,
        unit_price: item.price,
        picture_url: process.env.APP_URL + '/images/products/default.png',
      }));

      // Crear preferencia
      const preference = {
        // Items
        items: mpItems,

        // Datos del pagador
        payer: {
          name: customer.name,
          email: customer.email,
          phone: {
            area_code: '54', // Argentina
            number: customer.whatsapp?.replace(/\D/g, '') || '',
          },
        },

        // Moneda y total
        currency_id: 'ARS',
        total_amount: total,

        // URLs de redirección post-compra
        back_urls: {
          success: `${process.env.FRONTEND_URL}/checkout/success?order_id=${orderId}`,
          failure: `${process.env.FRONTEND_URL}/checkout/failure?order_id=${orderId}`,
          pending: `${process.env.FRONTEND_URL}/checkout/pending?order_id=${orderId}`,
        },

        // Auto-redireccionar
        auto_return: 'approved',

        // Número de orden interno
        external_reference: orderNumber.toString(),

        // Notificación webhook
        notification_url: notificationUrl,

        // Metadata personalizada
        metadata: {
          orderId: orderId.toString(),
          orderNumber: orderNumber,
          customerId: customer._id.toString(),
          customerEmail: customer.email,
        },

        // Configuración
        statement_descriptor: 'GADDYEL ECOMMERCE',
        expires: false,
      };

      logAudit('CREATE_PAYMENT_PREFERENCE', { orderNumber }, 'INFO');

      // Crear preferencia en Mercado Pago
      const response = await mercadopago.preferences.create(preference);

      if (response.status !== 201) {
        throw new Error('Error al crear preferencia en Mercado Pago');
      }

      logAudit('PAYMENT_PREFERENCE_CREATED', { preferenceId: response.body.id, orderNumber }, 'INFO');

      return {
        preferenceId: response.body.id,
        checkoutUrl: response.body.init_point,
        sandboxCheckoutUrl: response.body.sandbox_init_point,
        externalReference: response.body.external_reference,
      };
    } catch (error) {
      logAudit('PAYMENT_PREFERENCE_ERROR', { orderNumber, error: error.message }, 'ERROR');
      throw new Error(`Error al crear preferencia: ${error.message}`);
    }
  }

  /**
   * Validar firma del webhook de Mercado Pago
   * @param {Object} headers - Headers del request
   * @param {String} body - Body del request como string
   * @returns {Boolean} - True si es válido
   */
  static validateWebhookSignature(headers, body) {
    try {
      const xSignature = headers['x-signature'];
      const xRequestId = headers['x-request-id'];

      if (!xSignature || !xRequestId) {
        logSecurity('WEBHOOK_MISSING_SIGNATURE', 'high', { headers: Object.keys(headers) });
        return false;
      }

      // Mercado Pago envía la firma en formato: "ts=...,v1=..."
      const parts = xSignature.split(',');
      const timestamp = parts[0].split('=')[1];
      const signature = parts[1].split('=')[1];

      // Crear hash
      const data = `${xRequestId}:${body}`;
      const hash = crypto
        .createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET)
        .update(data)
        .digest('hex');

      const isValid = hash === signature;

      if (!isValid) {
        logSecurity('WEBHOOK_INVALID_SIGNATURE', 'high', { xRequestId, expectedSignature: signature });
      }

      return isValid;
    } catch (error) {
      logSecurity('WEBHOOK_SIGNATURE_ERROR', 'medium', { error: error.message });
      return false;
    }
  }

  /**
   * Obtener detalles de pago desde Mercado Pago
   * @param {String} paymentId - ID del pago en Mercado Pago
   * @returns {Object} - Detalles del pago
   */
  static async getPaymentDetails(paymentId) {
    try {
      logAudit('GET_PAYMENT_DETAILS', { paymentId }, 'INFO');

      const response = await mercadopago.payment.findById(paymentId);

      if (response.status !== 200) {
        throw new Error('Pago no encontrado');
      }

      const payment = response.body;

      return {
        paymentId: payment.id,
        status: payment.status, // approved, pending, in_process, rejected
        statusDetail: payment.status_detail,
        amount: payment.transaction_amount,
        currency: payment.currency_id,
        paymentMethod: payment.payment_method_id,
        paymentType: payment.payment_type_id, // account_money, card, bank_transfer
        externalReference: payment.external_reference,
        description: payment.description,
        cardLastFour: payment.card?.last_four_digits || null,
        cardBrand: payment.card?.first_six_digits ? this.getCardBrand(payment.card.first_six_digits) : null,
        installments: payment.installments || 0,
        issuerBank: payment.issuer_id || null,
        approvalCode: payment.authorization_code || null,
        authorizationCode: payment.auth_code || null,
        createdAt: payment.date_created,
        approvedAt: payment.date_approved,
        transaction: {
          id: payment.transaction_id,
          acquirerProcessingMode: payment.acquirer_reconciliation?.acquirer_processing_mode || null,
        },
      };
    } catch (error) {
      logAudit('GET_PAYMENT_DETAILS_ERROR', { paymentId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Procesar notificación webhook de Mercado Pago
   * @param {Object} notificationData - Datos del webhook
   * @returns {Object} - Datos procesados del pago
   */
  static async processWebhookNotification(notificationData) {
    try {
      const { resource, data } = notificationData;

      if (!resource && !data?.id) {
        throw new Error('Datos de notificación inválidos');
      }

      // Mercado Pago envía la notificación con el ID del pago
      const paymentId = resource || data.id;

      logWebhook('mercadopago', 'payment_notification', { paymentId }, true);

      // Obtener detalles completos del pago
      const paymentDetails = await this.getPaymentDetails(paymentId);

      return {
        success: true,
        paymentDetails,
        processedAt: new Date(),
      };
    } catch (error) {
      logWebhook('mercadopago', 'payment_notification', { error: error.message }, false);
      throw error;
    }
  }

  /**
   * Refundar un pago
   * @param {String} paymentId - ID del pago
   * @param {Number} amount - Cantidad a refundar (opcional, si no se pone es total)
   * @returns {Object} - Resultado del reembolso
   */
  static async refundPayment(paymentId, amount = null) {
    try {
      logAudit('REFUND_PAYMENT', { paymentId, amount }, 'INFO');

      const refundData = amount ? { amount } : {};

      const response = await mercadopago.refund.create(paymentId, refundData);

      if (response.status !== 201) {
        throw new Error('Error al procesar reembolso');
      }

      logAudit('REFUND_PROCESSED', { refundId: response.body.id, paymentId, amount: response.body.amount }, 'INFO');

      return {
        refundId: response.body.id,
        paymentId: response.body.payment_id,
        amount: response.body.amount,
        status: response.body.status,
        createdAt: response.body.date_created,
      };
    } catch (error) {
      logAudit('REFUND_ERROR', { paymentId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Obtener datos de reconciliación (para auditoría)
   * @param {String} paymentId - ID del pago
   * @returns {Object} - Datos de reconciliación
   */
  static async getReconciliationData(paymentId) {
    try {
      const payment = await mercadopago.payment.findById(paymentId);

      if (payment.status !== 200) {
        throw new Error('Pago no encontrado');
      }

      const data = payment.body;

      return {
        paymentId: data.id,
        netReceivedAmount: data.net_received_amount || 0,
        totalPaidAmount: data.transaction_amount || 0,
        fee: data.fee || 0,
        grossAmount: data.gross_amount || 0,
        couponAmount: data.coupon_amount || 0,
        differentialFeeAmount: data.differential_fee_amount || 0,
      };
    } catch (error) {
      logAudit('RECONCILIATION_ERROR', { paymentId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Helper: Obtener marca de tarjeta desde primeros 6 dígitos
   * @param {String} firstSixDigits - Primeros 6 dígitos
   * @returns {String} - Marca de tarjeta
   */
  static getCardBrand(firstSixDigits) {
    const bin = firstSixDigits;

    // Visa: 4
    if (bin.startsWith('4')) return 'visa';
    
    // Mastercard: 5
    if (bin.startsWith('5')) return 'mastercard';
    
    // American Express: 3
    if (bin.startsWith('3')) return 'amex';
    
    // Discover: 6
    if (bin.startsWith('6')) return 'discover';
    
    return 'unknown';
  }

  /**
   * Helper: Obtener descripción de estado de pago
   * @param {String} status - Status del pago
   * @returns {String} - Descripción
   */
  static getStatusDescription(status) {
    const statusMap = {
      'approved': 'Pago aprobado',
      'pending': 'Pago pendiente',
      'authorized': 'Pago autorizado',
      'in_process': 'Pago en procesamiento',
      'rejected': 'Pago rechazado',
      'cancelled': 'Pago cancelado',
      'refunded': 'Pago reembolsado',
      'charged_back': 'Contracargo',
    };

    return statusMap[status] || 'Estado desconocido';
  }
}

module.exports = MercadoPagoService;
