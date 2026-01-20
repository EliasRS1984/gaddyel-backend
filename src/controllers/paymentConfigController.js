/**
 * Controller: PaymentConfig
 * 
 * PROPÓSITO:
 * - Gestionar configuración global de comisiones
 * - Actualizar tasas y recalcular productos masivamente
 * - Proveer historial de cambios para auditoría
 * 
 * ENDPOINTS:
 * - GET /api/payment-config - Obtener configuración actual
 * - PUT /api/payment-config - Actualizar tasa y recalcular productos
 * - GET /api/payment-config/historial - Ver cambios históricos
 */

import PaymentConfig from '../models/PaymentConfig.js';
import { Producto } from '../models/Product.js';

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
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración de pagos',
      error: error.message
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

    // PASO CRÍTICO: Recalcular todos los productos
    let productosActualizados = 0;
    
    if (tasaComision !== undefined && tasaComision !== tasaAnterior) {
      console.log(`🔄 Recalculando precios con nueva tasa: ${tasaComision * 100}%`);
      
      const productos = await Producto.find({});
      
      for (const producto of productos) {
        // Calcular nuevo precio de venta usando precioBase
        const nuevoPrecioVenta = config.calcularPrecioVenta(producto.precioBase);
        
        producto.precio = nuevoPrecioVenta;
        producto.tasaComisionAplicada = tasaComision;
        producto.fechaActualizacionPrecio = new Date();
        
        await producto.save();
        productosActualizados++;
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
    console.error('Error actualizando configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
      error: error.message
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
      data: config.historial.reverse() // Más recientes primero
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
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
    
    // Usar tasa proporcionada o la actual
    const tasa = tasaComision !== undefined ? tasaComision : config.tasaComision;
    const comisionFija = config.comisionFija;

    // Calcular precio de venta
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
    console.error('Error calculando preview:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular preview',
      error: error.message
    });
  }
};

export default {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreview
};
