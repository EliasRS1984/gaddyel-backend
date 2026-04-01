/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La configuración de comisiones de Mercado Pago guardada en la base de datos.
 * En lugar de tener la tasa de comisión escrita fija en el código,
 * se guarda aquí para poder cambiarla desde el panel sin tocar el servidor.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El admin modifica la tasa de comisión desde el panel.
 * 2. El nuevo valor se guarda aquí en la base de datos.
 * 3. Se dispara un recálculo masivo de todos los productos.
 * 4. Los productos quedan con el precio ya incluyendo la comisión.
 * 5. En el checkout: el cliente ve el precio final sin cargos extra.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los precios no se actualizan al cambiar la tasa? → Revisar el controlador paymentConfigController
 * - ¿El cálculo de precio es incorrecto? → Revisar el método 'calcularPrecioVenta'
 * - Fórmula: PrecioVenta = (PrecioBase + comisiónFija) / (1 - tasa)
 * ======================================================
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

  // ✅ CORREGIDO: ref apuntaba a 'AdminUser' pero el modelo se llama 'Admin'
  actualizadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  // Historial de cambios (últimos 10)
  historial: [{
    tasaAnterior: Number,
    tasaNueva: Number,
    fecha: { type: Date, default: Date.now },
    // ✅ CORREGIDO: ref apuntaba a 'AdminUser' pero el modelo se llama 'Admin'
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    productosAfectados: Number
  }]
}, {
  timestamps: true
});

// Devuelve la configuración activa. Si no existe ninguna, la crea con valores por defecto.
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

// Calcula el precio de venta a partir del precio base aplicando la comisión de MP.
// Fórmula: (PrecioBase + comisiónFija) / (1 - tasa)
paymentConfigSchema.methods.calcularPrecioVenta = function(precioBase) {
  const r = this.tasaComision;
  const f = this.comisionFija;
  
  // Fórmula: PrecioVenta = (PrecioBase + f) / (1 - r)
  const precioVenta = (precioBase + f) / (1 - r);
  
  // Redondear a 2 decimales
  return Math.round(precioVenta * 100) / 100;
};

// Calcula el precio base a partir del precio de venta (operación inversa).
// Se usa cuando el admin quiere saber cuánto recibe neto de un precio publicado.
paymentConfigSchema.methods.calcularPrecioBase = function(precioVenta) {
  const r = this.tasaComision;
  const f = this.comisionFija;
  
  // Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
  const precioBase = precioVenta * (1 - r) - f;
  
  return Math.round(precioBase * 100) / 100;
};

const PaymentConfig = mongoose.model('PaymentConfig', paymentConfigSchema);

export default PaymentConfig;
