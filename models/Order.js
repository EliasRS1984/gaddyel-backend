const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // Items del pedido
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true },
      subtotal: { type: Number, required: true }
    }
  ],

  // Información del cliente
  customer: {
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    whatsapp: { type: String, required: true },
    identification: {
      type: {
        type: String,
        enum: ['DNI', 'PASSPORT', 'OTROS'],
        default: 'DNI'
      },
      number: String
    }
  },

  // Información de envío
  shipping: {
    address: String,
    notes: String,
    deadlineDate: Date,
    shippingCost: { type: Number, default: 0 },
    shippingMethod: {
      type: String,
      enum: ['LOCAL_DELIVERY', 'PICKUP', 'EXTERNAL'],
      default: 'LOCAL_DELIVERY'
    }
  },

  // Información de pago
  payment: {
    mp_preference_id: String,
    mp_payment_id: String,
    mp_status: {
      type: String,
      enum: [
        'approved',
        'pending',
        'in_process',
        'rejected',
        'cancelled',
        'refunded',
        'charged_back'
      ],
      default: 'pending'
    },
    mp_status_detail: String,
    payment_type_id: {
      type: String,
      enum: ['credit_card', 'debit_card', 'online_transfer', 'consumer_credits'],
      default: 'credit_card'
    },
    payment_method_id: {
      type: String,
      default: 'unknown'
    },
    transaction_amount: Number,
    total_paid_amount: { type: Number, default: 0 },
    installments: { type: Number, default: 1 },
    captured: { type: Boolean, default: false },
    refunded: { type: Boolean, default: false },
    refund_amount: { type: Number, default: 0 },
    isFromMercadoCredito: { type: Boolean, default: false },
    rawPayload: mongoose.Schema.Types.Mixed,
    last_error_message: String
  },

  // Estado de la orden
  orderStatus: {
    type: String,
    enum: [
      'pending_payment',           // Esperando pago
      'waiting_confirmation',      // Pago verificándose
      'paid',                       // Pagado
      'rejected',                   // Pago rechazado
      'cancelled',                  // Cancelado por usuario
      'frozen',                     // Congelado (chargeback)
      'preparing',                  // En preparación
      'shipped',                    // Enviado
      'delivered',                  // Entregado
      'failed_payment_permanent'    // Falla permanente
    ],
    default: 'pending_payment'
  },

  // Resumen de totales
  totals: {
    subtotal: { type: Number, required: true },
    taxes: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },

  // Metadata
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    paymentUpdatedAt: Date,
    lastRetryAt: Date,
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    adminNotes: String
  },

  // Referencia al cliente si existe en BD
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  }
});

// Índices para búsquedas rápidas
OrderSchema.index({ 'customer.email': 1 });
OrderSchema.index({ 'mp_payment_id': 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ 'metadata.createdAt': -1 });

module.exports = mongoose.model('Order', OrderSchema);
