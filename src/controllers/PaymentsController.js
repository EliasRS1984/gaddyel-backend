/**
 * Controller: Payments
 * Descripción: Manejo de pagos y webhooks
 * Propósito: Iniciar checkout, procesar webhooks, actualizar estados de pago
 */

const Order = require('../models/Order');
const MercadoPagoService = require('../services/mercadopagoService');
const OrderService = require('../services/orderService');
const { logAudit, logWebhook, logSecurity } = require('../utils/logger');

class PaymentsController {
  /**
   * POST /api/checkout
   * Iniciar checkout - crear preferencia de Mercado Pago
   */
  static async initiateCheckout(req, res) {
    try {
      const { orderId } = req.body;

      logAudit('INITIATE_CHECKOUT', { orderId }, 'INFO');

      // Obtener orden
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      // Verificar que esté en estado correcto
      if (order.status !== 'pending_payment') {
        return res.status(400).json({
          success: false,
          error: `No se puede iniciar checkout para orden en estado "${order.status}"`,
        });
      }

      // Si ya tiene preferencia, retornarla
      if (order.mercadopagoPreferenceId && order.checkoutUrl) {
        return res.status(200).json({
          success: true,
          data: {
            preferenceId: order.mercadopagoPreferenceId,
            checkoutUrl: order.checkoutUrl,
            sandboxCheckoutUrl: order.sandboxCheckoutUrl,
          },
        });
      }

      logAudit('CHECKOUT_CREATION_FAILED', { orderId, reason: 'No preference ID' }, 'ERROR');

      return res.status(500).json({
        success: false,
        error: 'Error al obtener información de checkout',
      });
    } catch (error) {
      logAudit('INITIATE_CHECKOUT_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error al iniciar checkout',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * POST /api/webhooks/mercadopago
   * Webhook de notificación de Mercado Pago
   */
  static async handleWebhook(req, res) {
    try {
      const body = JSON.stringify(req.body);

      // Validar firma
      const isValid = MercadoPagoService.validateWebhookSignature(req.headers, body);
      if (!isValid) {
        logSecurity('WEBHOOK_INVALID_SIGNATURE', 'high', {
          type: req.body.type,
          data: req.body.data?.id,
        });

        return res.status(401).json({
          success: false,
          error: 'Firma de webhook inválida',
        });
      }

      const { type, data } = req.body;

      logWebhook('mercadopago', type, { paymentId: data?.id }, true);

      // Procesar según tipo de notificación
      if (type === 'payment') {
        return await this.handlePaymentNotification(req, res, data);
      }

      if (type === 'plan' || type === 'subscription') {
        logWebhook('mercadopago', `${type}_notification`, {}, false);
        return res.status(200).json({ success: true, message: 'Notificación procesada' });
      }

      return res.status(200).json({ success: true, message: 'Notificación recibida' });
    } catch (error) {
      logWebhook('mercadopago', 'error', { error: error.message }, false);

      res.status(500).json({
        success: false,
        error: 'Error procesando webhook',
      });
    }
  }

  /**
   * Manejar notificación de pago
   */
  static async handlePaymentNotification(req, res, paymentData) {
    try {
      const paymentId = paymentData?.id;
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment ID no encontrado',
        });
      }

      // Obtener detalles del pago desde Mercado Pago
      const paymentDetails = await MercadoPagoService.getPaymentDetails(paymentId);

      // Buscar orden por referencia externa
      const order = await Order.findOne({
        mercadopagoPreferenceId: req.body.data?.id || paymentId,
      });

      if (!order) {
        // Buscar por número de orden en external_reference
        const orderNumber = paymentDetails.externalReference;
        const orderByNumber = await Order.findOne({ orderNumber: parseInt(orderNumber) });

        if (!orderByNumber) {
          logAudit('WEBHOOK_ORDER_NOT_FOUND', { paymentId, externalReference: orderNumber }, 'WARNING');
          return res.status(404).json({
            success: false,
            error: 'Orden no encontrada',
          });
        }

        return await this.processPaymentByStatus(orderByNumber, paymentDetails, res);
      }

      return await this.processPaymentByStatus(order, paymentDetails, res);
    } catch (error) {
      logAudit('HANDLE_PAYMENT_NOTIFICATION_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error procesando notificación de pago',
      });
    }
  }

  /**
   * Procesar pago según su estado
   */
  static async processPaymentByStatus(order, paymentDetails, res) {
    try {
      switch (paymentDetails.status) {
        case 'approved':
          await OrderService.processPaymentSuccess(order._id, {
            paymentId: paymentDetails.paymentId,
            status: 'approved',
            amount: paymentDetails.amount,
          });

          logAudit('PAYMENT_APPROVED_WEBHOOK', { orderId: order._id, paymentId: paymentDetails.paymentId }, 'INFO');

          return res.status(200).json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              status: 'approved',
              message: 'Pago aprobado',
            },
          });

        case 'pending':
          await OrderService.processPaymentPending(order._id, {
            paymentId: paymentDetails.paymentId,
            statusDetail: paymentDetails.statusDetail,
          });

          logAudit('PAYMENT_PENDING_WEBHOOK', { orderId: order._id, paymentId: paymentDetails.paymentId }, 'INFO');

          return res.status(200).json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              status: 'pending',
              message: 'Pago pendiente',
            },
          });

        case 'rejected':
        case 'cancelled':
          await OrderService.processPaymentRejected(order._id, {
            paymentId: paymentDetails.paymentId,
            statusDetail: paymentDetails.statusDetail,
          });

          logAudit('PAYMENT_REJECTED_WEBHOOK', { orderId: order._id, paymentId: paymentDetails.paymentId, reason: paymentDetails.statusDetail }, 'WARNING');

          return res.status(200).json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              status: 'rejected',
              message: `Pago rechazado: ${paymentDetails.statusDetail}`,
            },
          });

        default:
          logAudit('UNKNOWN_PAYMENT_STATUS', { paymentId: paymentDetails.paymentId, status: paymentDetails.status }, 'WARNING');

          return res.status(200).json({
            success: true,
            data: {
              orderNumber: order.orderNumber,
              status: paymentDetails.status,
              message: 'Pago procesado',
            },
          });
      }
    } catch (error) {
      logAudit('PROCESS_PAYMENT_BY_STATUS_ERROR', { orderId: order._id, error: error.message }, 'ERROR');

      return res.status(500).json({
        success: false,
        error: 'Error procesando estado de pago',
      });
    }
  }

  /**
   * GET /api/orders/:orderId/status
   * Obtener estado de pago de una orden
   */
  static async getPaymentStatus(req, res) {
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId).select(
        'orderNumber status total paymentHistory mercadopagoPreferenceId'
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      // Último intento de pago
      const lastPaymentAttempt = order.paymentHistory?.[order.paymentHistory.length - 1];

      res.status(200).json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          lastPaymentAttempt: lastPaymentAttempt ? {
            paymentId: lastPaymentAttempt.paymentId,
            status: lastPaymentAttempt.status,
            amount: lastPaymentAttempt.amount,
            timestamp: lastPaymentAttempt.timestamp,
            failureReason: lastPaymentAttempt.failureReason,
          } : null,
          canRetry: order.allowRetry(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estado de pago',
      });
    }
  }

  /**
   * POST /api/orders/:orderId/retry
   * Reintentar pago
   */
  static async retryPayment(req, res) {
    try {
      const { orderId } = req.params;

      logAudit('RETRY_PAYMENT_REQUEST', { orderId }, 'INFO');

      const result = await OrderService.retryPayment(orderId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logAudit('RETRY_PAYMENT_ERROR', { orderId: req.params.orderId, error: error.message }, 'ERROR');

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/orders/:orderId/refund
   * Solicitar reembolso
   */
  static async refundPayment(req, res) {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      logAudit('REFUND_REQUEST', { orderId, reason }, 'INFO');

      const result = await OrderService.refundOrder(orderId, reason);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Reembolso procesado exitosamente',
      });
    } catch (error) {
      logAudit('REFUND_ERROR', { orderId: req.params.orderId, error: error.message }, 'ERROR');

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = PaymentsController;
