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
 * 
 * REDONDEO COMERCIAL INTELIGENTE:
 * 1. Calcula precio exacto con comisión
 * 2. Redondea a la CENTENA más cercana hacia arriba
 * 3. Retorna objeto con datos completos para auditoría
 * 
 * @returns {Object} {
 *   precioVenta: number,          // Precio final redondeado
 *   precioExacto: number,          // Precio antes del redondeo
 *   ajusteRedondeo: number,        // Diferencia por redondeo
 *   montoComision: number,         // Comisión total aplicada
 *   tasaAplicada: number           // Tasa utilizada
 * }
 */
systemConfigSchema.methods.calcularPrecioVenta = function(precioBase) {
  const r = this.comisiones.mercadoPago.tasaComision;
  const f = this.comisiones.mercadoPago.comisionFija;
  
  // Fórmula: PrecioVenta = (PrecioBase + f) / (1 - r)
  const precioExacto = (precioBase + f) / (1 - r);
  
  // REDONDEO COMERCIAL: Hacia arriba a la centena más cercana
  const precioRedondeado = Math.ceil(precioExacto / 100) * 100;
  
  // Calcular metadatos para auditoría contable
  const ajusteRedondeo = precioRedondeado - precioExacto;
  const montoComision = precioRedondeado - precioBase;
  
  return {
    precioVenta: precioRedondeado,
    precioExacto: Math.round(precioExacto * 100) / 100, // 2 decimales
    ajusteRedondeo: Math.round(ajusteRedondeo * 100) / 100,
    montoComision: Math.round(montoComision * 100) / 100,
    tasaAplicada: r
  };
};

/**
 * Calcular precio base a partir de precio de venta (reversa)
 * Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
 * 
 * Redondea a centena hacia arriba para mantener consistencia
 */
systemConfigSchema.methods.calcularPrecioBase = function(precioVenta) {
  const r = this.comisiones.mercadoPago.tasaComision;
  const f = this.comisiones.mercadoPago.comisionFija;
  
  // Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
  const precioBase = precioVenta * (1 - r) - f;
  
  // Redondeo a centena hacia arriba
  return Math.ceil(precioBase / 100) * 100;
};

/**
 * 🧾 AUDITORÍA: Calcular desglose contable para órdenes
 * 
 * ESTRUCTURA DEL DESGLOSE:
 * 1. precioBasePorItem: Precio base real de items (sin recargo MP)
 * 2. costoEnvio: Precio de envío (YA incluye recargo MP incorporado)
 * 3. ajusteRedondeoTotal: Ganancia adicional por redondeo comercial
 * 4. comisionMercadoPago: Comisión que cobra MP sobre el total
 * 
 * NOTA IMPORTANTE:
 * El precio de envío es un valor general que YA TIENE el recargo de MP incorporado.
 * Es un precio basado en el costo promedio de envíos, no se calcula individualmente.
 * 
 * Fórmula: Total = precioBasePorItem + costoEnvio + ajusteRedondeo
 * Neto en Caja = Total - comisionMercadoPago
 * 
 * @param {Number} totalFinal - Precio total final (lo que paga el cliente)
 * @param {Array} items - Items con { precioUnitario, cantidad }
 * @param {Number} costoEnvio - Costo de envío (ya con recargo MP incorporado)
 * @returns {Object} { precioBasePorItem, comisionMercadoPago, ajusteRedondeoTotal, costoEnvio }
 */
systemConfigSchema.methods.calcularDesgloceOrden = function(totalFinal, items, costoEnvio = 0) {
  const r = this.comisiones.mercadoPago.tasaComision;
  
  // 1️⃣ Calcular precio base de items (sin recargo MP)
  let precioBasePorItem = 0;
  
  for (const item of items) {
    // Cada item tiene precioUnitario con recargo incluido
    // Calculamos base: precioBase = precioVenta * (1 - tasa)
    const precioBaseItem = item.precioUnitario * (1 - r);
    const subtotalBase = precioBaseItem * item.cantidad;
    precioBasePorItem += subtotalBase;
  }
  
  // Redondear precio base de items
  precioBasePorItem = Math.round(precioBasePorItem * 100) / 100;
  
  // 2️⃣ Comisión MP sobre el TOTAL (incluye items + envío)
  const comisionMercadoPago = totalFinal * r;
  
  // 3️⃣ Ajuste de redondeo = Total - (PrecioBase Items + Envío)
  // El envío YA tiene el recargo incorporado, así que:
  const ajusteRedondeoTotal = totalFinal - precioBasePorItem - costoEnvio;
  
  return {
    precioBasePorItem: Math.round(precioBasePorItem * 100) / 100,
    costoEnvio: Math.round(costoEnvio * 100) / 100,
    ajusteRedondeoTotal: Math.round(ajusteRedondeoTotal * 100) / 100,
    comisionMercadoPago: Math.round(comisionMercadoPago * 100) / 100
  };
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
