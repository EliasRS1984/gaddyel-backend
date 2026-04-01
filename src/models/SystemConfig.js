/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La configuración global del sistema guardada en la base de datos.
 * Centraliza todos los parámetros ajustables: costos de envío,
 * tasas de comisión y límites de productos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Existe un único documento de configuración (patrón singleton).
 * 2. El admin puede cambiar valores desde el panel sin tocar el servidor.
 * 3. Al cambiar la tasa de comisión, el controlador llama a 'calcularPrecioVenta'
 *    para recalcular todos los productos.
 * 4. Cada cambio queda registrado en 'historial' para auditoría.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El envío gratis no aplica? → Revisar 'habilitarEnvioGratis' y 'cantidadParaEnvioGratis'
 * - ¿El precio calculado es incorrecto? → Revisar el método 'calcularPrecioVenta'
 * - Fórmula de precio: (precioBase + comisiónFija) / (1 - tasa), redondeado a la centena
 * ======================================================
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
    ref: 'Admin'  // ✅ CORREGIDO M2: el modelo se llama 'Admin', no 'AdminUser'
  },

  // Historial de cambios (últimos 10)
  historial: [{
    campo: String,
    valorAnterior: mongoose.Schema.Types.Mixed,
    valorNuevo: mongoose.Schema.Types.Mixed,
    fecha: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }  // ✅ CORREGIDO M2
  }]
}, {
  timestamps: true
});

// ======== MÉTODOS ESTÁTICOS ========

// Devuelve la configuración activa. Si no existe, la crea con valores por defecto.
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

// ======== MÉTODOS DE INSTANCIA ========

// Calcula el costo de envío según la cantidad de productos en el carrito.
// Si la cantidad supera el umbral, el envío es gratis.
systemConfigSchema.methods.calcularEnvio = function(cantidadProductos) {
  if (!this.envio.habilitarEnvioGratis) {
    return this.envio.costoBase;
  }
  
  return cantidadProductos >= this.envio.cantidadParaEnvioGratis 
    ? 0 
    : this.envio.costoBase;
};

// Calcula el precio de venta a partir del precio base aplicando la comisión de MP.
// Redondea hacia arriba a la centena más cercana para evitar precios con decimales.
// Devuelve el precio final + datos de auditoría contable.
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

// Calcula el precio base a partir del precio de venta publicado (operación inversa).
// Fórmula: PrecioBase = PrecioVenta * (1 - tasa) - comisiónFija
systemConfigSchema.methods.calcularPrecioBase = function(precioVenta) {
  const r = this.comisiones.mercadoPago.tasaComision;
  const f = this.comisiones.mercadoPago.comisionFija;
  
  // Fórmula inversa: PrecioBase = PrecioVenta * (1 - r) - f
  const precioBase = precioVenta * (1 - r) - f;
  
  // Redondeo a centena hacia arriba
  return Math.ceil(precioBase / 100) * 100;
};

// Calcula el desglose contable de una orden para auditoría.
// Recibe el total cobrado al cliente, los items y el costo de envío.
// Devuelve: precioBasePorItem, comisiónMercadoPago, ajusteRedondeo y costoEnvío.
// Fórmula: Total = precioBasePorItem + costoEnvio + ajusteRedondeo
// Neto en Caja = Total - comisionMercadoPago
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
