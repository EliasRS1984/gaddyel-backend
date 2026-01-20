/**
 * Modelo: SystemConfig
 * 
 * PROPÓSITO:
 * - Configuración global centralizada del sistema
 * - Evitar hardcodear valores en código
 * - Permitir actualización sin redeploy
 * 
 * ALCANCE:
 * - Envío: Costos, cantidad para envío gratis
 * - Pagos: Comisiones de pasarelas
 * - Productos: Límites, reglas de negocio
 * - General: Configuraciones varias
 */

import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  // Identificador único (singleton pattern)
  configKey: {
    type: String,
    default: 'system_default',
    unique: true,
    required: true
  },

  // ============================================
  // CONFIGURACIÓN DE ENVÍO
  // ============================================
  envio: {
    costoBase: {
      type: Number,
      default: 12000,
      min: 0,
      description: 'Costo de envío en ARS'
    },
    cantidadParaEnvioGratis: {
      type: Number,
      default: 3,
      min: 0,
      description: 'Cantidad de productos para envío gratis'
    },
    habilitarEnvioGratis: {
      type: Boolean,
      default: true,
      description: 'Si está activa la promoción de envío gratis'
    }
  },

  // ============================================
  // CONFIGURACIÓN DE COMISIONES DE PASARELA
  // ============================================
  comisiones: {
    mercadoPago: {
      tasaComision: {
        type: Number,
        default: 0.0761,
        min: 0,
        max: 0.25,
        description: 'Tasa de comisión MP (0.0761 = 7.61%)'
      },
      comisionFija: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Comisión fija en ARS'
      },
      estrategia: {
        type: String,
        enum: ['bake_in', 'dynamic'],
        default: 'bake_in',
        description: 'bake_in = precio ya inflado, dynamic = calcular en checkout'
      }
    }
  },

  // ============================================
  // CONFIGURACIÓN DE PRODUCTOS
  // ============================================
  productos: {
    maxImagenes: {
      type: Number,
      default: 20,
      min: 1,
      max: 50
    },
    maxVariantes: {
      type: Number,
      default: 30,
      min: 1,
      max: 100
    }
  },

  // ============================================
  // METADATOS
  // ============================================
  activo: {
    type: Boolean,
    default: true
  },

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
    campo: String,
    valorAnterior: mongoose.Schema.Types.Mixed,
    valorNuevo: mongoose.Schema.Types.Mixed,
    fecha: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }
  }]
}, {
  timestamps: true
});

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

/**
 * Obtener configuración actual del sistema
 */
systemConfigSchema.statics.obtenerConfigActual = async function() {
  let config = await this.findOne({ configKey: 'system_default' });
  
  // Si no existe, crear configuración por defecto
  if (!config) {
    config = await this.create({
      configKey: 'system_default',
      envio: {
        costoBase: 12000,
        cantidadParaEnvioGratis: 3,
        habilitarEnvioGratis: true
      },
      comisiones: {
        mercadoPago: {
          tasaComision: 0.0761,
          comisionFija: 0,
          estrategia: 'bake_in'
        }
      },
      productos: {
        maxImagenes: 20,
        maxVariantes: 30
      }
    });
  }
  
  return config;
};

// ============================================
// MÉTODOS DE INSTANCIA - CÁLCULOS
// ============================================

/**
 * Calcular costo de envío según cantidad de productos
 */
systemConfigSchema.methods.calcularEnvio = function(cantidadProductos) {
  if (!this.envio.habilitarEnvioGratis) {
    return this.envio.costoBase;
  }
  
  return cantidadProductos >= this.envio.cantidadParaEnvioGratis 
    ? 0 
    : this.envio.costoBase;
};

/**
 * Calcular precio de venta a partir de precio base (con comisión MP)
 */
systemConfigSchema.methods.calcularPrecioVenta = function(precioBase) {
  const r = this.comisiones.mercadoPago.tasaComision;
  const f = this.comisiones.mercadoPago.comisionFija;
  
  // Fórmula: PrecioVenta = (PrecioBase + f) / (1 - r)
  const precioVenta = (precioBase + f) / (1 - r);
  
  // Redondear a 2 decimales
  return Math.round(precioVenta * 100) / 100;
};

/**
 * Calcular precio base a partir de precio de venta (reversa)
 */
systemConfigSchema.methods.calcularPrecioBase = function(precioVenta) {
  const r = this.comisiones.mercadoPago.tasaComision;
  const f = this.comisiones.mercadoPago.comisionFija;
  
  // Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
  const precioBase = precioVenta * (1 - r) - f;
  
  return Math.round(precioBase * 100) / 100;
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
