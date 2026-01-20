/**
 * Controller: SystemConfig
 * 
 * PROPÓSITO:
 * - Gestionar configuración global del sistema
 * - CRUD de configuraciones centralizadas (envío, comisiones, límites)
 * - Historial de cambios para auditoría
 */

import SystemConfig from '../models/SystemConfig.js';
import { Producto } from '../models/Product.js';

/**
 * GET /api/system-config
 * Obtener configuración actual del sistema
 */
export const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await SystemConfig.obtenerConfigActual();
    
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
      message: 'Error al obtener configuración del sistema',
      error: error.message
    });
  }
};

/**
 * PUT /api/system-config
 * Actualizar configuración del sistema
 * 
 * FLUJO:
 * 1. Validar datos recibidos
 * 2. Obtener configuración actual
 * 3. Registrar cambios en historial
 * 4. Actualizar configuración
 * 5. Si cambió tasa de comisión → recalcular productos
 */
export const actualizarConfiguracion = async (req, res) => {
  try {
    const { envio, comisiones, productos } = req.body;
    const usuarioId = req.user?._id;

    // Validaciones
    if (!envio && !comisiones && !productos) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos una sección para actualizar'
      });
    }

    const config = await SystemConfig.obtenerConfigActual();
    let cambios = [];
    let productosActualizados = 0;

    // ============================================
    // ACTUALIZAR ENVÍO
    // ============================================
    if (envio) {
      if (envio.costoBase !== undefined) {
        if (envio.costoBase < 0) {
          return res.status(400).json({
            success: false,
            message: 'El costo de envío no puede ser negativo'
          });
        }
        
        cambios.push({
          campo: 'envio.costoBase',
          valorAnterior: config.envio.costoBase,
          valorNuevo: envio.costoBase,
          usuario: usuarioId
        });
        
        config.envio.costoBase = envio.costoBase;
      }

      if (envio.cantidadParaEnvioGratis !== undefined) {
        if (envio.cantidadParaEnvioGratis < 0) {
          return res.status(400).json({
            success: false,
            message: 'La cantidad para envío gratis no puede ser negativa'
          });
        }
        
        cambios.push({
          campo: 'envio.cantidadParaEnvioGratis',
          valorAnterior: config.envio.cantidadParaEnvioGratis,
          valorNuevo: envio.cantidadParaEnvioGratis,
          usuario: usuarioId
        });
        
        config.envio.cantidadParaEnvioGratis = envio.cantidadParaEnvioGratis;
      }

      if (envio.habilitarEnvioGratis !== undefined) {
        cambios.push({
          campo: 'envio.habilitarEnvioGratis',
          valorAnterior: config.envio.habilitarEnvioGratis,
          valorNuevo: envio.habilitarEnvioGratis,
          usuario: usuarioId
        });
        
        config.envio.habilitarEnvioGratis = envio.habilitarEnvioGratis;
      }
    }

    // ============================================
    // ACTUALIZAR COMISIONES
    // ============================================
    if (comisiones?.mercadoPago) {
      const mp = comisiones.mercadoPago;
      
      if (mp.tasaComision !== undefined) {
        if (mp.tasaComision < 0 || mp.tasaComision > 0.25) {
          return res.status(400).json({
            success: false,
            message: 'La tasa de comisión debe estar entre 0% y 25%'
          });
        }
        
        const tasaAnterior = config.comisiones.mercadoPago.tasaComision;
        
        cambios.push({
          campo: 'comisiones.mercadoPago.tasaComision',
          valorAnterior: tasaAnterior,
          valorNuevo: mp.tasaComision,
          usuario: usuarioId
        });
        
        config.comisiones.mercadoPago.tasaComision = mp.tasaComision;

        // CRÍTICO: Recalcular todos los productos si cambió la tasa
        if (mp.tasaComision !== tasaAnterior) {
          console.log(`🔄 Recalculando precios con nueva tasa: ${mp.tasaComision * 100}%`);
          
          const productosExistentes = await Producto.find({});
          
          for (const producto of productosExistentes) {
            if (producto.precioBase) {
              const nuevoPrecioVenta = config.calcularPrecioVenta(producto.precioBase);
              
              producto.precio = nuevoPrecioVenta;
              producto.tasaComisionAplicada = mp.tasaComision;
              producto.fechaActualizacionPrecio = new Date();
              
              await producto.save();
              productosActualizados++;
            }
          }
        }
      }

      if (mp.comisionFija !== undefined) {
        cambios.push({
          campo: 'comisiones.mercadoPago.comisionFija',
          valorAnterior: config.comisiones.mercadoPago.comisionFija,
          valorNuevo: mp.comisionFija,
          usuario: usuarioId
        });
        
        config.comisiones.mercadoPago.comisionFija = mp.comisionFija;
      }

      if (mp.estrategia !== undefined) {
        cambios.push({
          campo: 'comisiones.mercadoPago.estrategia',
          valorAnterior: config.comisiones.mercadoPago.estrategia,
          valorNuevo: mp.estrategia,
          usuario: usuarioId
        });
        
        config.comisiones.mercadoPago.estrategia = mp.estrategia;
      }
    }

    // ============================================
    // ACTUALIZAR LÍMITES DE PRODUCTOS
    // ============================================
    if (productos) {
      if (productos.maxImagenes !== undefined) {
        cambios.push({
          campo: 'productos.maxImagenes',
          valorAnterior: config.productos.maxImagenes,
          valorNuevo: productos.maxImagenes,
          usuario: usuarioId
        });
        
        config.productos.maxImagenes = productos.maxImagenes;
      }

      if (productos.maxVariantes !== undefined) {
        cambios.push({
          campo: 'productos.maxVariantes',
          valorAnterior: config.productos.maxVariantes,
          valorNuevo: productos.maxVariantes,
          usuario: usuarioId
        });
        
        config.productos.maxVariantes = productos.maxVariantes;
      }
    }

    // Agregar cambios al historial
    if (cambios.length > 0) {
      config.historial.push(...cambios);
      
      // Mantener solo los últimos 20 registros
      if (config.historial.length > 20) {
        config.historial = config.historial.slice(-20);
      }
    }

    config.ultimaActualizacion = new Date();
    if (usuarioId) config.actualizadoPor = usuarioId;

    await config.save();

    res.status(200).json({
      success: true,
      message: `Configuración actualizada. ${productosActualizados > 0 ? `${productosActualizados} productos recalculados.` : ''}`,
      data: {
        cambiosAplicados: cambios.length,
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
 * GET /api/system-config/historial
 * Obtener historial de cambios de configuración
 */
export const obtenerHistorial = async (req, res) => {
  try {
    const config = await SystemConfig.obtenerConfigActual();
    
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
 * POST /api/system-config/preview-precio
 * Calcular preview de precio sin guardar
 */
export const calcularPreviewPrecio = async (req, res) => {
  try {
    const { precioBase, tasaComision } = req.body;

    if (!precioBase || precioBase <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un precio base válido'
      });
    }

    const config = await SystemConfig.obtenerConfigActual();
    
    // Usar tasa proporcionada o la actual
    const tasa = tasaComision !== undefined ? tasaComision : config.comisiones.mercadoPago.tasaComision;
    const comisionFija = config.comisiones.mercadoPago.comisionFija;

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

/**
 * POST /api/system-config/migrate-pricing
 * Ejecutar migración de precios (agregar precioBase a productos existentes)
 * 
 * FLUJO:
 * 1. Encontrar productos sin precioBase (o con precioBase = 0)
 * 2. Para cada producto: calcular precioBase = precio * (1 - tasa)
 * 3. Actualizar documento
 * 4. Retornar resumen de migración
 * 
 * ⚠️ PROTEGIDO: Solo admins pueden ejecutar
 */
export const migrarPrecios = async (req, res) => {
  try {
    console.log('\n🔄 Iniciando migración de precios desde endpoint...\n');

    const TASA_MIGRACION = 0.0761;

    // Encontrar productos sin precioBase
    const productosParaMigrar = await Producto.find({
      $or: [
        { precioBase: { $exists: false } },
        { precioBase: null },
        { precioBase: { $eq: 0 } }
      ]
    });

    console.log(`📊 Productos encontrados sin precioBase: ${productosParaMigrar.length}`);

    if (productosParaMigrar.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay productos para migrar',
        data: {
          migrados: 0,
          errores: 0,
          total: 0
        }
      });
    }

    // Migrar cada producto
    let migrados = 0;
    let errores = [];

    for (const producto of productosParaMigrar) {
      try {
        const precioBase = producto.precio * (1 - TASA_MIGRACION);
        const precioBaseRedondeado = Math.round(precioBase * 100) / 100;

        await Producto.findByIdAndUpdate(
          producto._id,
          {
            precioBase: precioBaseRedondeado,
            tasaComisionAplicada: TASA_MIGRACION,
            fechaActualizacionPrecio: new Date()
          },
          { new: true }
        );

        migrados++;
        console.log(`✅ [${migrados}/${productosParaMigrar.length}] ${producto.nombre}`);

      } catch (error) {
        errores.push({
          productoId: producto._id,
          nombre: producto.nombre,
          error: error.message
        });
        console.error(`❌ Error en ${producto.nombre}: ${error.message}`);
      }
    }

    console.log(`\n✅ Migración completada: ${migrados} exitosos, ${errores.length} errores\n`);

    res.status(200).json({
      success: true,
      message: `Migración completada: ${migrados} productos actualizados`,
      data: {
        migrados,
        errores: errores.length,
        total: productosParaMigrar.length,
        detalleErrores: errores.length > 0 ? errores : undefined
      }
    });

  } catch (error) {
    console.error('Error en migración de precios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar migración de precios',
      error: error.message
    });
  }
};

export default {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreviewPrecio,
  migrarPrecios
};
