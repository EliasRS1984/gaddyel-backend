/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de configuración de comisiones de Mercado Pago.
 * Permite al administrador ajustar la tasa de comisión que se aplica
 * a los productos, y cuando cambia, recalcula todos los precios de venta.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El admin consulta la configuración actual (tasa, comisión fija, estrategia).
 * 2. Si el admin cambia la tasa, se recalculan TODOS los precios en un solo paso (bulkWrite).
 * 3. El cambio queda registrado en un historial con fecha y cantidad de productos afectados.
 * 4. También existe un endpoint para hacer un "preview" del precio resultante sin guardar.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los precios no se actualizaron? → Revisar actualizarConfiguracion (buscar error en logs)
 * - ¿El historial está vacío? → Revisar obtenerHistorial
 * - ¿El preview calcula mal? → Revisar calcularPreview (fórmula: precioBase / (1 - tasa))
 * ======================================================
 */

import PaymentConfig from '../models/PaymentConfig.js';
import { Producto } from '../models/Product.js';
import logger from '../utils/logger.js';

/**
 * GET /api/payment-config
 * Obtener configuración actual de comisiones
 */
export const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await PaymentConfig.obtenerConfigActual();
    
    // Contar productos existentes
    const totalProductos = await Producto.countDocuments();
    
    res.status(200).json({
      success: true,
      data: {
        ...config.toObject(),
        totalProductos
      }
    });
  } catch (error) {
    logger.error('Error obteniendo configuración de pagos', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración de pagos'
    });
  }
};

/**
 * PUT /api/payment-config
 * Actualizar tasa de comisión y recalcular todos los productos
 * 
 * FLUJO:
 * 1. Validar nueva tasa
 * 2. Obtener configuración actual
 * 3. Guardar en historial
 * 4. Actualizar configuración
 * 5. Recalcular TODOS los productos con nueva tasa
 * 6. Retornar resumen de cambios
 */
export const actualizarConfiguracion = async (req, res) => {
  try {
    const { tasaComision, comisionFija, estrategia } = req.body;
    const usuarioId = req.user?._id; // Desde middleware auth

    // Validaciones
    if (tasaComision === undefined && comisionFija === undefined && estrategia === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    if (tasaComision !== undefined) {
      if (tasaComision < 0 || tasaComision > 0.25) {
        return res.status(400).json({
          success: false,
          message: 'La tasa de comisión debe estar entre 0% y 25%'
        });
      }
    }

    // Obtener configuración actual
    const config = await PaymentConfig.obtenerConfigActual();
    const tasaAnterior = config.tasaComision;

    // Preparar actualización
    const updates = {};
    if (tasaComision !== undefined) updates.tasaComision = tasaComision;
    if (comisionFija !== undefined) updates.comisionFija = comisionFija;
    if (estrategia !== undefined) updates.estrategia = estrategia;
    updates.ultimaActualizacion = new Date();
    if (usuarioId) updates.actualizadoPor = usuarioId;

    // Actualizar configuración
    Object.assign(config, updates);

    // PASO CRÍTICO: Recalcular todos los productos con la nueva tasa
    let productosActualizados = 0;
    
    if (tasaComision !== undefined && tasaComision !== tasaAnterior) {
      logger.info('Recalculando precios por cambio de tasa de comisión');
      
      // ✅ RENDIMIENTO (C1): Carga solo los productos con precioBase válido UNA sola vez
      // y arma una única operación masiva (bulkWrite) en lugar de N saves individuales.
      // Antes: 1 query + N saves = N+1 operaciones de base de datos.
      // Ahora: 1 query + 1 bulkWrite = 2 operaciones de base de datos.
      // El filtro $gt: 0 evita pisar con precio $0 los productos sin precioBase definido.
      const productos = await Producto.find({
        precioBase: { $exists: true, $gt: 0 }
      }).lean();
      
      if (productos.length > 0) {
        const ahora = new Date();
        // calcularPrecioVenta de PaymentConfig devuelve un número directamente (Math.round a 2 decimales)
        // Se usa el mismo formato que ya tenía este controlador
        const operaciones = productos.map(producto => ({
          updateOne: {
            filter: { _id: producto._id },
            update: {
              $set: {
                precio: config.calcularPrecioVenta(producto.precioBase),
                tasaComisionAplicada: tasaComision,
                fechaActualizacionPrecio: ahora
              }
            }
          }
        }));

        const resultado = await Producto.bulkWrite(operaciones, { ordered: false });
        productosActualizados = resultado.modifiedCount;
      }

      // Guardar en historial
      config.historial.push({
        tasaAnterior,
        tasaNueva: tasaComision,
        fecha: new Date(),
        usuario: usuarioId,
        productosAfectados: productosActualizados
      });

      // Mantener solo los últimos 10 registros
      if (config.historial.length > 10) {
        config.historial = config.historial.slice(-10);
      }
    }

    await config.save();

    res.status(200).json({
      success: true,
      message: `Configuración actualizada. ${productosActualizados} productos recalculados.`,
      data: {
        configAnterior: {
          tasaComision: tasaAnterior
        },
        configNueva: {
          tasaComision: config.tasaComision,
          comisionFija: config.comisionFija,
          estrategia: config.estrategia
        },
        productosActualizados
      }
    });

  } catch (error) {
    logger.error('Error actualizando configuración de pagos', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración'
    });
  }
};

/**
 * GET /api/payment-config/historial
 * Obtener historial de cambios de configuración
 */
export const obtenerHistorial = async (req, res) => {
  try {
    const config = await PaymentConfig.obtenerConfigActual();
    
    res.status(200).json({
      success: true,
      data: config.historial.reverse()
    });
  } catch (error) {
    logger.error('Error obteniendo historial de configuración de pagos', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial'
    });
  }
};

/**
 * POST /api/payment-config/calcular-preview
 * Calcular preview de precios sin guardar cambios
 */
export const calcularPreview = async (req, res) => {
  try {
    const { tasaComision, precioBase } = req.body;

    if (!precioBase || precioBase <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un precio base válido'
      });
    }

    const config = await PaymentConfig.obtenerConfigActual();
    
    const tasa = tasaComision !== undefined ? tasaComision : config.tasaComision;
    const comisionFija = config.comisionFija;

    const precioVenta = (precioBase + comisionFija) / (1 - tasa);
    const recargo = precioVenta - precioBase;
    const porcentajeRecargo = (recargo / precioBase) * 100;

    res.status(200).json({
      success: true,
      data: {
        precioBase,
        precioVenta: Math.round(precioVenta * 100) / 100,
        recargo: Math.round(recargo * 100) / 100,
        porcentajeRecargo: Math.round(porcentajeRecargo * 100) / 100,
        tasaUsada: tasa,
        comisionFija
      }
    });

  } catch (error) {
    logger.error('Error calculando preview de precio', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al calcular preview'
    });
  }
};

export default {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreview
};
