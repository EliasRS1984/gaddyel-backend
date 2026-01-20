/**
 * Modelo: PaymentConfig
 * 
 * PROPÓSITO:
 * - Almacenar configuración global de comisiones de pasarelas de pago
 * - Permitir actualización centralizada sin redeploy
 * - Historial de cambios para auditoría
 * 
 * FLUJO:
 * 1. Admin modifica tasa desde panel
 * 2. Se guarda en DB
 * 3. Se dispara recálculo masivo de productos
 * 4. Productos quedan con precio ya inflado
 * 5. En checkout: se muestra precio final sin recargos adicionales
 */

import mongoose from 'mongoose';

const paymentConfigSchema = new mongoose.Schema({
  // Identificador único (singleton pattern)
  configKey: {
    type: String,
    default: 'mercadopago_default',
    unique: true,
    required: true
  },

  // Tasa de comisión (ej: 0.0761 = 7.61%)
  tasaComision: {
    type: Number,
    required: true,
    min: 0,
    max: 0.25, // Máximo 25% por seguridad
    default: 0.0761
  },

  // Comisión fija en pesos (opcional, generalmente 0 para MP)
  comisionFija: {
    type: Number,
    default: 0,
    min: 0
  },

  // Estrategia de aplicación
  estrategia: {
    type: String,
    enum: ['bake_in', 'dynamic'], // bake_in = precio ya inflado, dynamic = calcular en checkout
    default: 'bake_in'
  },

  // Metadatos
  activo: {
    type: Boolean,
    default: true
  },

  // Auditoría
  ultimaActualizacion: {
    type: Date,
    default: Date.now
  },

  actualizadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },

  // Historial de cambios (últimos 10)
  historial: [{
    tasaAnterior: Number,
    tasaNueva: Number,
    fecha: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    productosAfectados: Number
  }]
}, {
  timestamps: true
});

// Método estático para obtener configuración actual
paymentConfigSchema.statics.obtenerConfigActual = async function() {
  let config = await this.findOne({ configKey: 'mercadopago_default' });
  
  // Si no existe, crear configuración por defecto
  if (!config) {
    config = await this.create({
      configKey: 'mercadopago_default',
      tasaComision: 0.0761,
      comisionFija: 0,
      estrategia: 'bake_in'
    });
  }
  
  return config;
};

// Método para calcular precio de venta a partir de precio base
paymentConfigSchema.methods.calcularPrecioVenta = function(precioBase) {
  const r = this.tasaComision;
  const f = this.comisionFija;
  
  // Fórmula: PrecioVenta = (PrecioBase + f) / (1 - r)
  const precioVenta = (precioBase + f) / (1 - r);
  
  // Redondear a 2 decimales
  return Math.round(precioVenta * 100) / 100;
};

// Método para calcular precio base a partir de precio de venta (reversa)
paymentConfigSchema.methods.calcularPrecioBase = function(precioVenta) {
  const r = this.tasaComision;
  const f = this.comisionFija;
  
  // Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
  const precioBase = precioVenta * (1 - r) - f;
  
  return Math.round(precioBase * 100) / 100;
};

const PaymentConfig = mongoose.model('PaymentConfig', paymentConfigSchema);

export default PaymentConfig;
