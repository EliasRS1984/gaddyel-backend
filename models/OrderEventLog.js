const mongoose = require('mongoose');

const OrderEventLogSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },

  // Estados
  oldStatus: String,
  newStatus: String,
  
  // Info de pago
  mpStatus: String,
  mpStatusDetail: String,
  mpPaymentId: String,
  
  // Razón del cambio
  reason: {
    type: String,
    enum: [
      'PAYMENT_APPROVED',
      'PAYMENT_PENDING',
      'PAYMENT_IN_PROCESS',
      'PAYMENT_REJECTED',
      'PAYMENT_CANCELLED',
      'PAYMENT_REFUNDED',
      'CHARGEBACK_RECEIVED',
      'MANUAL_STATUS_CHANGE',
      'RETRY_INITIATED',
      'ADMIN_ACTION',
      'WEBHOOK_EVENT',
      'ERROR_DETECTED'
    ]
  },

  // Raw payload del webhook
  rawEvent: mongoose.Schema.Types.Mixed,
  
  // Timestamp
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Usuario que generó el cambio (si es admin)
  triggeredBy: {
    type: String,
    enum: ['WEBHOOK', 'ADMIN', 'SYSTEM'],
    default: 'WEBHOOK'
  },
  
  adminId: String,
  
  // Detalles adicionales
  details: {
    errorMessage: String,
    ipAddress: String,
    userAgent: String
  }
});

// Índice compuesto para auditoría
OrderEventLogSchema.index({ orderId: 1, timestamp: -1 });

module.exports = mongoose.model('OrderEventLog', OrderEventLogSchema);
