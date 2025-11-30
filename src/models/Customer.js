/**
 * Model: Customer
 * Descripción: Esquema de cliente con historial de órdenes y direcciones
 * Propósito: Almacenar información de clientes y relacionarla con órdenes
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'Argentina' },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const customerSchema = new Schema({
  // Información personal
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
  },
  
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido'],
  },
  
  whatsapp: {
    type: String,
    required: [true, 'El WhatsApp es requerido'],
    match: [/^[\d\s\+\-\(\)]{7,}$/, 'Número de teléfono inválido'],
  },
  
  // Identificación (opcional)
  cuit: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^\d{2}\-\d{8}\-\d{1}$/, 'CUIT inválido. Formato: XX-XXXXXXXX-X'],
  },
  
  dni: {
    type: String,
    sparse: true,
  },
  
  // Direcciones
  addresses: [addressSchema],
  
  // Dirección de envío por defecto
  defaultAddressId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
  },
  
  // Historial de órdenes
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'Order',
  }],
  
  // Estadísticas
  totalOrders: {
    type: Number,
    default: 0,
  },
  
  totalSpent: {
    type: Number,
    default: 0,
  },
  
  lastOrderDate: Date,
  
  // Estado
  isActive: {
    type: Boolean,
    default: true,
  },
  
  notes: String,
  
  // Preferencias
  preferences: {
    newsletter: { type: Boolean, default: false },
    notifications: { type: Boolean, default: true },
  },
  
  // Auditoría
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  lastLogin: Date,
});

// Índices para mejora de performance
customerSchema.index({ email: 1 });
customerSchema.index({ cuit: 1 });
customerSchema.index({ name: 'text' });
customerSchema.index({ createdAt: -1 });

// Middleware: Actualizar updatedAt antes de guardar
customerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para agregar dirección
customerSchema.methods.addAddress = function(addressData) {
  this.addresses.push(addressData);
  if (addressData.isDefault) {
    this.defaultAddressId = this.addresses[this.addresses.length - 1]._id;
  }
  return this.save();
};

// Método para actualizar dirección por defecto
customerSchema.methods.setDefaultAddress = function(addressId) {
  const address = this.addresses.id(addressId);
  if (!address) {
    throw new Error('Dirección no encontrada');
  }
  
  this.addresses.forEach(addr => {
    addr.isDefault = addr._id.equals(addressId);
  });
  this.defaultAddressId = addressId;
  return this.save();
};

// Método para obtener dirección por defecto
customerSchema.methods.getDefaultAddress = function() {
  if (this.defaultAddressId) {
    return this.addresses.id(this.defaultAddressId);
  }
  return this.addresses.length > 0 ? this.addresses[0] : null;
};

// Método para registrar orden
customerSchema.methods.recordOrder = function(orderId, orderTotal) {
  this.orderHistory.push(orderId);
  this.totalOrders += 1;
  this.totalSpent += orderTotal;
  this.lastOrderDate = Date.now();
  return this.save();
};

// Método estático para buscar o crear cliente
customerSchema.statics.findOrCreateByEmail = async function(customerData) {
  let customer = await this.findOne({ email: customerData.email });
  
  if (!customer) {
    customer = new this({
      name: customerData.name,
      email: customerData.email,
      whatsapp: customerData.whatsapp,
      cuit: customerData.cuit,
      dni: customerData.dni,
    });
    
    if (customerData.address) {
      customer.addresses.push({
        ...customerData.address,
        isDefault: true,
      });
      customer.defaultAddressId = customer.addresses[0]._id;
    }
    
    await customer.save();
  }
  
  return customer;
};

module.exports = mongoose.model('Customer', customerSchema);
