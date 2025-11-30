/**
 * Model: Order
 * Descripción: Esquema de orden con soporte para pagos, estados y auditoría
 * Propósito: Almacenar información completa de órdenes y su historial de pagos
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Producto requerido'],
  },
  
  productName: String, // Snapshot del nombre en el momento de compra
  productImage: String, // Snapshot de la imagen
  
  quantity: {
    type: Number,
    required: [true, 'Cantidad requerida'],
    min: [1, 'Cantidad mínima es 1'],
  },
  
  price: {
    type: Number,
    required: [true, 'Precio unitario requerido'],
    min: [0, 'Precio no puede ser negativo'],
  },
  
  subtotal: {
    type: Number,
    required: [true, 'Subtotal requerido'],
    min: [0, 'Subtotal no puede ser negativo'],
  },
  
  // Variaciones si aplica (ej: talle, color)
  variations: {
    type: Map,
    of: String,
  },
  
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const paymentHistorySchema = new Schema({
  paymentId: String,
  status: {
    type: String,
    enum: [
      'approved',        // Aprobado
      'pending',         // Pendiente
      'in_process',      // En procesamiento
      'rejected',        // Rechazado
      'cancelled',       // Cancelado
      'refunded',        // Reembolsado
      'expired',         // Expirado
    ],
  },
  amount: Number,
  method: String, // credit_card, debit_card, wallet, etc
  processor: {
    type: String,
    default: 'mercado_pago',
  },
  statusDetail: String,
  rejectionReason: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  failureAttempt: { type: Number, default: 0 },
  rawResponse: Schema.Types.Mixed, // Guardar respuesta completa para auditoría
});

const orderSchema = new Schema({
  // Información de cliente
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Cliente requerido'],
    index: true,
  },
  
  // Snapshot de datos del cliente (para auditoría)
  customerSnapshot: {
    name: String,
    email: String,
    whatsapp: String,
  },
  
  // Dirección de envío
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  
  // Items de la orden
  items: {
    type: [orderItemSchema],
    required: [true, 'La orden debe tener al menos un ítem'],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'La orden debe tener al menos un producto',
    },
  },
  
  // Totales
  subtotal: {
    type: Number,
    required: [true, 'Subtotal requerido'],
    min: [0, 'Subtotal no puede ser negativo'],
  },
  
  shippingCost: {
    type: Number,
    default: 0,
    min: [0, 'Costo de envío no puede ser negativo'],
  },
  
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Descuento no puede ser negativo'],
  },
  
  discountReason: String,
  
  total: {
    type: Number,
    required: [true, 'Total requerido'],
    min: [0, 'Total no puede ser negativo'],
  },
  
  // Número de orden (único e incremental)
  orderNumber: {
    type: Number,
    unique: true,
    index: true,
  },
  
  // Estados de la orden
  status: {
    type: String,
    enum: [
      'pending_payment',    // Esperando pago
      'paid',              // Pagado
      'processing',        // En procesamiento
      'shipped',           // Enviado
      'delivered',         // Entregado
      'cancelled',         // Cancelado
      'refunded',          // Reembolsado
      'failed',            // Fallo en pago
    ],
    default: 'pending_payment',
    index: true,
  },
  
  // Información de pago - Mercado Pago
  mercadopagoPreferenceId: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  mercadopagoCheckoutUrl: String,
  
  // Información de pago - General
  paymentMethod: String, // credit_card, debit_card, etc
  
  paymentStatus: {
    type: String,
    enum: [
      'pending',
      'approved',
      'rejected',
      'expired',
      'refunded',
    ],
    default: 'pending',
  },
  
  // Pago registrado
  paymentId: String,
  
  paymentDetails: {
    processor: String,
    paymentId: String,
    transactionId: String,
    authorizedAmount: Number,
    approvalCode: String,
    bankProcessingCode: String,
  },
  
  // Historial de intentos de pago
  paymentHistory: [paymentHistorySchema],
  
  // Información de envío
  shippingMethod: String,
  
  trackingNumber: String,
  
  shippedAt: Date,
  
  deliveredAt: Date,
  
  // Notas
  internalNotes: String,
  customerNotes: String,
  
  // Reembolsos
  refundHistory: [{
    refundId: String,
    amount: Number,
    reason: String,
    status: String,
    requestedAt: Date,
    processedAt: Date,
  }],
  
  // Auditoría
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  // IP y user agent del cliente (seguridad)
  createdFromIP: String,
  createdFromUserAgent: String,
  
  // Validación de duplicados
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
});

// Índices para mejora de performance
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentId: 1 });
orderSchema.index({ mercadopagoPreferenceId: 1 });
orderSchema.index({ 'paymentHistory.paymentId': 1 });

// Middleware: Actualizar updatedAt antes de guardar
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para registrar intento de pago
orderSchema.methods.recordPaymentAttempt = function(paymentInfo) {
  const historyEntry = {
    ...paymentInfo,
    timestamp: Date.now(),
  };
  
  this.paymentHistory.push(historyEntry);
  
  // Actualizar estado actual
  if (paymentInfo.status === 'approved') {
    this.paymentStatus = 'approved';
    this.status = 'paid';
    this.paymentId = paymentInfo.paymentId;
  } else if (paymentInfo.status === 'rejected') {
    this.paymentStatus = 'rejected';
  } else if (paymentInfo.status === 'expired') {
    this.paymentStatus = 'expired';
    this.status = 'cancelled';
  }
  
  return this.save();
};

// Método para registrar rechazo de pago
orderSchema.methods.markPaymentFailed = function(reason, paymentId) {
  this.paymentStatus = 'rejected';
  this.status = 'failed';
  this.internalNotes = `Pago rechazado: ${reason}`;
  
  this.paymentHistory.push({
    paymentId,
    status: 'rejected',
    rejectionReason: reason,
    timestamp: Date.now(),
    failureAttempt: this.paymentHistory.length + 1,
  });
  
  return this.save();
};

// Método para permitir reintentar pago
orderSchema.methods.allowRetry = function() {
  if (this.status === 'failed' || this.paymentStatus === 'rejected') {
    this.status = 'pending_payment';
    this.paymentStatus = 'pending';
    return this.save();
  }
  throw new Error('Esta orden no puede ser reintentada');
};

// Método para procesar reembolso
orderSchema.methods.refund = function(amount, reason) {
  if (this.status !== 'paid') {
    throw new Error('Solo se pueden reembolsar órdenes pagadas');
  }
  
  this.refundHistory.push({
    amount,
    reason,
    status: 'pending',
    requestedAt: Date.now(),
  });
  
  return this.save();
};

// Método para calcular y validar total
orderSchema.methods.validateTotal = function() {
  const calculatedSubtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  const calculatedTotal = calculatedSubtotal + this.shippingCost - this.discount;
  
  if (Math.abs(this.subtotal - calculatedSubtotal) > 0.01) {
    throw new Error('Subtotal no coincide con suma de ítems');
  }
  
  if (Math.abs(this.total - calculatedTotal) > 0.01) {
    throw new Error('Total no coincide con cálculo');
  }
  
  return true;
};

// Método estático para obtener próximo número de orden
orderSchema.statics.getNextOrderNumber = async function() {
  const lastOrder = await this.findOne().sort({ orderNumber: -1 });
  return (lastOrder?.orderNumber || 0) + 1;
};

// Método estático para crear orden con seguridad
orderSchema.statics.createSecureOrder = async function(orderData) {
  const order = new this(orderData);
  order.validateTotal();
  order.orderNumber = await this.getNextOrderNumber();
  return order.save();
};

module.exports = mongoose.model('Order', orderSchema);

// Índices para búsquedas rápidas
orderSchema.index({ clienteId: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPago: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPedido: 1, fechaCreacion: -1 });
// orderNumber ya tiene unique: true e index: true que crea índice automático
// mercadoPagoId ya tiene unique: true que crea índice automático
orderSchema.index({ 'datosComprador.email': 1 });

export default mongoose.model('Order', orderSchema);
