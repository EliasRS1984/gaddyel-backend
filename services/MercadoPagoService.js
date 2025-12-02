const axios = require('axios');
const Order = require('../models/Order');
const OrderEventLog = require('../models/OrderEventLog');

class MercadoPagoService {
  constructor() {
    this.accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    this.publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY;
    this.notificationUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL;
    this.baseUrl = 'https://api.mercadopago.com';
  }

  /**
   * Crear preferencia de pago
   */
  async createPreference(order) {
    try {
      const items = order.items.map(item => ({
        id: item.productId.toString(),
        title: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: 'ARS'
      }));

      const payer = {
        name: order.customer.fullName.split(' ')[0],
        surname: order.customer.fullName.split(' ').slice(1).join(' '),
        email: order.customer.email,
        phone: {
          area_code: '54',
          number: order.customer.whatsapp.replace(/\D/g, '')
        }
      };

      const paymentMethods = {
        installments: 12,
        excluded_payment_methods: [
          { id: 'amex' } // Excluir AMEX si no se quiere
        ],
        excluded_payment_types: [],
        default_payment_method_id: null,
        default_installments: 1
      };

      // Habilitar Mercado Crédito explícitamente
      const creditConfiguration = {
        installments: 6
      };

      const preference = {
        items: items,
        payer: payer,
        payment_methods: paymentMethods,
        marketplace_fee: process.env.MARKETPLACE_FEE || 0,
        back_urls: {
          success: process.env.SUCCESS_URL || 'http://localhost:3000/payment-success',
          failure: process.env.FAILURE_URL || 'http://localhost:3000/payment-failure',
          pending: process.env.PENDING_URL || 'http://localhost:3000/payment-pending'
        },
        auto_return: 'approved',
        notification_url: this.notificationUrl,
        external_reference: order._id.toString(),
        statement_descriptor: 'GADDYEL',
        expires: false,
        taxes: null,
        shipments: {
          receiver_address: {
            zip_code: '00000',
            street_name: 'N/A',
            street_number: 0,
            floor: 0,
            apartment: '0'
          }
        }
      };

      // Agregar soporte para Mercado Crédito
      if (order.payment.isFromMercadoCredito) {
        preference.payment_methods.credit = creditConfiguration;
      }

      const response = await axios.post(
        `${this.baseUrl}/checkout/preferences`,
        preference,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `${order._id}-${Date.now()}`
          }
        }
      );

      return {
        preferenceId: response.data.id,
        checkoutUrl: response.data.init_point,
        sandboxUrl: response.data.sandbox_init_point
      };
    } catch (error) {
      console.error('Error creating MP preference:', error.response?.data || error.message);
      throw new Error(`Failed to create Mercado Pago preference: ${error.message}`);
    }
  }

  /**
   * Obtener información del pago desde MP
   */
  async getPaymentInfo(paymentId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching MP payment:', error.response?.data || error.message);
      throw new Error(`Failed to fetch payment information: ${error.message}`);
    }
  }

  /**
   * Validar firma del webhook
   */
  validateWebhookSignature(data, signature, timestamp, xRequestId) {
    const crypto = require('crypto');
    
    // Construir string a firmar
    const signatureString = `id=${data.id};request-id=${xRequestId};timestamp=${timestamp}`;
    
    // Crear HMAC
    const hmac = crypto
      .createHmac('sha256', this.publicKey)
      .update(signatureString)
      .digest('hex');
    
    return hmac === signature;
  }

  /**
   * Procesar webhook de pago
   */
  async processWebhook(paymentId, topic = 'payment') {
    try {
      // Obtener detalles del pago
      const paymentInfo = await this.getPaymentInfo(paymentId);
      
      // Buscar la orden
      const order = await Order.findOne({
        'payment.mp_payment_id': paymentId
      });

      if (!order) {
        throw new Error(`Order not found for payment ${paymentId}`);
      }

      // Determinar nuevo estado
      const newStatus = this.mapMPStatusToOrderStatus(
        paymentInfo.status,
        paymentInfo.status_detail,
        paymentInfo.payment_method_id,
        order.orderStatus
      );

      // Detectar Mercado Crédito
      const isFromMercadoCredito = paymentInfo.payment_method_id === 'mercado_credito';

      // Actualizar orden
      const oldStatus = order.orderStatus;
      
      order.payment.mp_status = paymentInfo.status;
      order.payment.mp_status_detail = paymentInfo.status_detail;
      order.payment.payment_type_id = paymentInfo.payment_type_id;
      order.payment.payment_method_id = paymentInfo.payment_method_id;
      order.payment.total_paid_amount = paymentInfo.transaction_amount;
      order.payment.installments = paymentInfo.installments || 1;
      order.payment.captured = paymentInfo.captured;
      order.payment.isFromMercadoCredito = isFromMercadoCredito;
      order.payment.rawPayload = paymentInfo;
      order.orderStatus = newStatus;
      order.metadata.paymentUpdatedAt = new Date();

      await order.save();

      // Registrar en auditoría
      await this.logOrderEvent(
        order._id,
        oldStatus,
        newStatus,
        paymentInfo.status,
        paymentInfo.status_detail,
        'WEBHOOK_EVENT',
        paymentInfo,
        'WEBHOOK'
      );

      return order;
    } catch (error) {
      console.error('Error processing webhook:', error.message);
      throw error;
    }
  }

  /**
   * Mapear estado de MP a estado de Orden
   */
  mapMPStatusToOrderStatus(mpStatus, mpStatusDetail, paymentMethodId, currentOrderStatus) {
    // Si la orden ya está pagada, no cambiar
    if (currentOrderStatus === 'paid') {
      return 'paid';
    }

    switch (mpStatus) {
      case 'approved':
        return 'paid';
      
      case 'pending':
        // Mercado Crédito pendiente evaluación
        if (paymentMethodId === 'mercado_credito') {
          return 'waiting_confirmation';
        }
        return 'in_process';
      
      case 'in_process':
        return 'in_process';
      
      case 'rejected':
        // Mantener para reintentar
        return 'rejected';
      
      case 'cancelled':
        return 'cancelled';
      
      case 'refunded':
        return 'rejected';
      
      case 'charged_back':
        return 'frozen';
      
      default:
        return 'waiting_confirmation';
    }
  }

  /**
   * Registrar evento de orden
   */
  async logOrderEvent(
    orderId,
    oldStatus,
    newStatus,
    mpStatus,
    mpStatusDetail,
    reason,
    rawEvent,
    triggeredBy = 'WEBHOOK'
  ) {
    try {
      const eventLog = new OrderEventLog({
        orderId,
        oldStatus,
        newStatus,
        mpStatus,
        mpStatusDetail,
        reason,
        rawEvent,
        triggeredBy,
        timestamp: new Date()
      });

      await eventLog.save();
      return eventLog;
    } catch (error) {
      console.error('Error logging order event:', error.message);
      // No fallar si la auditoría no se registra
    }
  }

  /**
   * Reintentar pago - Crear nueva preferencia
   */
  async retryPayment(orderId) {
    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.orderStatus === 'paid') {
        throw new Error('Order is already paid');
      }

      // Verificar límite de reintentos
      if (order.metadata.retryCount >= order.metadata.maxRetries) {
        throw new Error('Maximum retry attempts reached');
      }

      // Crear nueva preferencia
      const preference = await this.createPreference(order);

      // Actualizar orden
      order.payment.mp_preference_id = preference.preferenceId;
      order.metadata.lastRetryAt = new Date();
      order.metadata.retryCount += 1;

      await order.save();

      // Log del evento
      await this.logOrderEvent(
        orderId,
        order.orderStatus,
        order.orderStatus,
        'pending',
        'retry_initiated',
        'RETRY_INITIATED',
        { previousRetries: order.metadata.retryCount - 1 },
        'SYSTEM'
      );

      return preference;
    } catch (error) {
      console.error('Error retrying payment:', error.message);
      throw error;
    }
  }

  /**
   * Obtener detalle del error de pago
   */
  getPaymentErrorDetail(statusDetail) {
    const errorMessages = {
      'cc_rejected_insufficient_amount': 'Fondos insuficientes en la tarjeta',
      'cc_rejected_call_for_authorize': 'Contacte a su banco',
      'cc_rejected_max_attempts': 'Máximo de intentos superado',
      'cc_rejected_other_reason': 'Tarjeta rechazada',
      'customer_cancelled': 'Pago cancelado por el cliente',
      'cc_rejected_bad_filled_form': 'Datos de tarjeta incorrectos',
      'cc_rejected_form_error': 'Error en el formulario',
      'cc_rejected_fraud_risk': 'Transacción bloqueada por fraude',
      'cc_rejected_3d_secure_required': 'Verificación adicional requerida'
    };

    return errorMessages[statusDetail] || 'Error desconocido al procesar el pago';
  }
}

module.exports = new MercadoPagoService();
