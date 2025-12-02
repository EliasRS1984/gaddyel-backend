const Order = require('../models/Order');
const mercadoPagoService = require('../services/MercadoPagoService');

/**
 * Webhook de Mercado Pago
 * Recibe notificaciones de pagos
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { id, type, action } = req.query;
    const { data } = req.body;

    // Validar firma del webhook (opcional pero recomendado)
    // const signature = req.headers['x-signature'];
    // const timestamp = req.headers['x-timestamp'];
    // const xRequestId = req.headers['x-request-id'];
    // 
    // if (!mercadoPagoService.validateWebhookSignature(
    //   data,
    //   signature,
    //   timestamp,
    //   xRequestId
    // )) {
    //   console.warn('Invalid webhook signature');
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Responder inmediatamente con 200
    res.status(200).json({ status: 'received' });

    // Procesar el evento de forma asíncrona
    if (type === 'payment') {
      await processPaymentNotification(id, data);
    } else if (type === 'plan' || type === 'subscription') {
      // Manejar subscripciones si es necesario
      console.log(`Subscription event: ${action}`);
    } else if (type === 'merchant_order') {
      await processMerchantOrderNotification(id, data);
    }

  } catch (error) {
    console.error('Webhook error:', error.message);
    // No enviar errores al webhook para evitar reintentos innecesarios
    res.status(200).json({ status: 'error_processed' });
  }
};

/**
 * Procesar notificación de pago
 */
async function processPaymentNotification(paymentId, data) {
  try {
    console.log(`Processing payment webhook: ${paymentId}`);

    // Obtener información del pago desde Mercado Pago
    const paymentInfo = await mercadoPagoService.getPaymentInfo(paymentId);

    // Buscar orden en BD
    const order = await Order.findOne({
      'payment.mp_preference_id': paymentInfo.external_reference
    });

    if (!order) {
      console.warn(`Order not found for payment ${paymentId}`);
      return;
    }

    // Guardar payload raw
    const rawPayload = {
      timestamp: new Date(),
      paymentId: paymentId,
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      payment_method_id: paymentInfo.payment_method_id,
      payment_type_id: paymentInfo.payment_type_id,
      transaction_amount: paymentInfo.transaction_amount,
      installments: paymentInfo.installments,
      captured: paymentInfo.captured
    };

    // Actualizar orden
    const oldStatus = order.orderStatus;
    const newMPStatus = paymentInfo.status;
    const isFromMercadoCredito = paymentInfo.payment_method_id === 'mercado_credito';

    // Mapear estado
    let newOrderStatus = order.orderStatus;

    if (oldStatus === 'pending_payment') {
      newOrderStatus = mercadoPagoService.mapMPStatusToOrderStatus(
        newMPStatus,
        paymentInfo.status_detail,
        paymentInfo.payment_method_id,
        oldStatus
      );
    }

    // Actualizar order
    order.payment.mp_payment_id = paymentId;
    order.payment.mp_status = newMPStatus;
    order.payment.mp_status_detail = paymentInfo.status_detail;
    order.payment.payment_type_id = paymentInfo.payment_type_id;
    order.payment.payment_method_id = paymentInfo.payment_method_id;
    order.payment.transaction_amount = paymentInfo.transaction_amount;
    order.payment.total_paid_amount = paymentInfo.transaction_amount;
    order.payment.installments = paymentInfo.installments || 1;
    order.payment.captured = paymentInfo.captured;
    order.payment.isFromMercadoCredito = isFromMercadoCredito;
    order.payment.rawPayload = paymentInfo;
    order.orderStatus = newOrderStatus;
    order.metadata.paymentUpdatedAt = new Date();

    // Acciones especiales según estado
    if (newMPStatus === 'rejected' || newMPStatus === 'cancelled') {
      // Guardar razón del error
      order.payment.last_error_message = mercadoPagoService.getPaymentErrorDetail(
        paymentInfo.status_detail
      );

      // Si es permanente, intentar retry automático
      if (order.metadata.retryCount < order.metadata.maxRetries) {
        // Generar nuevo link en background
        scheduleRetryPayment(order._id, 5000); // Esperar 5 segundos
      }
    } else if (newMPStatus === 'charged_back') {
      // Congelado por chargeback
      order.orderStatus = 'frozen';
    }

    await order.save();

    // Registrar auditoría
    await mercadoPagoService.logOrderEvent(
      order._id,
      oldStatus,
      newOrderStatus,
      newMPStatus,
      paymentInfo.status_detail,
      getReasonForStatus(newMPStatus),
      rawPayload,
      'WEBHOOK'
    );

    console.log(`Payment webhook processed: Order ${order._id} -> ${newOrderStatus}`);

    // Notificar a admin (opcional)
    if (newOrderStatus === 'paid') {
      // Enviar email/notificación de pago aprobado
      // await notificationService.sendPaymentApprovedNotification(order);
    } else if (newMPStatus === 'rejected') {
      // Enviar email/notificación de pago rechazado
      // await notificationService.sendPaymentRejectedNotification(order);
    }

  } catch (error) {
    console.error('Error processing payment notification:', error.message);
  }
}

/**
 * Procesar notificación de merchant order
 */
async function processMerchantOrderNotification(merchantOrderId, data) {
  try {
    console.log(`Processing merchant order webhook: ${merchantOrderId}`);
    // Implementar si es necesario
  } catch (error) {
    console.error('Error processing merchant order notification:', error.message);
  }
}

/**
 * Programar reintentos automáticos
 */
function scheduleRetryPayment(orderId, delayMs = 5000) {
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId);
      if (!order || order.orderStatus === 'paid') return;

      console.log(`Auto-retrying payment for order ${orderId}`);

      // Crear nueva preferencia
      const preference = await mercadoPagoService.retryPayment(orderId);

      // Aquí se podría notificar al cliente con el nuevo link
      // await notificationService.sendRetryPaymentLink(order, preference.checkoutUrl);

    } catch (error) {
      console.error(`Failed to auto-retry payment for order ${orderId}:`, error.message);
    }
  }, delayMs);
}

/**
 * Mapear razón del status
 */
function getReasonForStatus(mpStatus) {
  const reasons = {
    'approved': 'PAYMENT_APPROVED',
    'pending': 'PAYMENT_PENDING',
    'in_process': 'PAYMENT_IN_PROCESS',
    'rejected': 'PAYMENT_REJECTED',
    'cancelled': 'PAYMENT_CANCELLED',
    'refunded': 'PAYMENT_REFUNDED',
    'charged_back': 'CHARGEBACK_RECEIVED'
  };

  return reasons[mpStatus] || 'WEBHOOK_EVENT';
}

/**
 * Webhook de prueba
 */
exports.testWebhook = async (req, res) => {
  try {
    // Para testing
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId and status required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    order.payment.mp_status = status;
    order.metadata.paymentUpdatedAt = new Date();

    await order.save();

    await mercadoPagoService.logOrderEvent(
      order._id,
      oldStatus,
      status,
      status,
      'test_webhook',
      'WEBHOOK_EVENT',
      { test: true },
      'WEBHOOK'
    );

    return res.status(200).json({
      message: 'Test webhook processed',
      orderId: order._id,
      status: order.orderStatus
    });
  } catch (error) {
    console.error('Test webhook error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
