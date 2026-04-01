/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de configuración global del sistema.
 * Gestiona las reglas de envío, tasas de comisión de Mercado Pago
 * y los límites de imágenes/variantes de productos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El admin puede consultar la configuración activa (tasas, envío, etc.).
 * 2. Al actualizar la tasa de comisión, se recalculan automáticamente TODOS los precios
 *    de venta usando un bulkWrite (operación masiva eficiente, no N queries individuales).
 * 3. Cada cambio se guarda en un historial para auditoría (quién, cuándo, qué cambió).
 * 4. También incluye herramientas de migración para actualizar productos con estructura vieja.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los precios no se actualizaron al cambiar la tasa? → Revisar actualizarConfiguracion
 * - ¿El cálculo de precio preview es incorrecto? → Revisar calcularPreviewPrecio
 * - ¿La migración de precios falla? → Revisar migrarPrecios y el estado de los productos
 * - ¿Los precios tienen decimales raros? → Revisar limpiarEstructuraPrecios
 * ======================================================
 */

import SystemConfig from '../models/SystemConfig.js';
import { Producto } from '../models/Product.js';
import logger from '../utils/logger.js';

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
    logger.error('Error al obtener configuración del sistema', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración del sistema',
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
          logger.info(`Recalculando precios con nueva tasa: ${mp.tasaComision * 100}%`);
          
          // ✅ RENDIMIENTO (C1): Una sola query + un bulkWrite en lugar de N saves individuales
          const productosExistentes = await Producto.find({
            precioBase: { $exists: true, $gt: 0 }
          }).lean();

          if (productosExistentes.length > 0) {
            const ahora = new Date();
            // calcularPrecioVenta devuelve un objeto {precioVenta, precioExacto, ajusteRedondeo, montoComision, tasaAplicada}
            // Se extraen todos los campos para mantener los datos de auditoría actualizados
            const operaciones = productosExistentes.map(producto => {
              const breakdown = config.calcularPrecioVenta(producto.precioBase);
              return {
                updateOne: {
                  filter: { _id: producto._id },
                  update: {
                    $set: {
                      precio: breakdown.precioVenta,
                      precioCalculadoExacto: breakdown.precioExacto,
                      ajusteRedondeo: breakdown.ajusteRedondeo,
                      montoComision: breakdown.montoComision,
                      tasaComisionAplicada: breakdown.tasaAplicada,
                      fechaActualizacionPrecio: ahora
                    }
                  }
                }
              };
            });
            const resultado = await Producto.bulkWrite(operaciones, { ordered: false });
            productosActualizados = resultado.modifiedCount;
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
    logger.error('Error al actualizar configuración del sistema', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
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
    logger.error('Error al obtener historial de configuración', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
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

    const precioVentaExacto = (precioBase + comisionFija) / (1 - tasa);
    // Redondear HACIA ARRIBA a número entero (sin decimales)
    const precioVenta = Math.ceil(precioVentaExacto);
    const recargo = precioVenta - precioBase;
    const porcentajeRecargo = (recargo / precioBase) * 100;

    res.status(200).json({
      success: true,
      data: {
        precioBase,
        precioVentaExacto: Math.round(precioVentaExacto * 100) / 100, // Mostrar cálculo exacto
        precioVenta, // Precio redondeado hacia arriba (SIN decimales)
        recargo,
        porcentajeRecargo: Math.round(porcentajeRecargo * 100) / 100,
        tasaUsada: tasa,
        comisionFija,
        nota: "El precioVenta es redondeado hacia arriba para evitar problemas con Mercado Pago"
      }
    });

  } catch (error) {
    logger.error('Error al calcular preview de precio', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al calcular preview',
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
    logger.info('Iniciando migración de precios desde endpoint');

    const TASA_MIGRACION = 0.0761;

    // Recolectar estadísticas antes de migrar para el diagnóstico
    const todosProductos = await Producto.find().select('_id nombre precio precioBase').lean();
    
    const conPrecioBase = todosProductos.filter(p => p.precioBase && p.precioBase > 0).length;
    const sinPrecioBase = todosProductos.filter(p => !p.precioBase || p.precioBase <= 0).length;
    
    logger.info(`Diagnóstico de productos: total=${todosProductos.length}, conPrecioBase=${conPrecioBase}, sinPrecioBase=${sinPrecioBase}`);

    // Encontrar productos sin precioBase válido
    const productosParaMigrar = await Producto.find({
      $or: [
        { precioBase: { $exists: false } },
        { precioBase: null },
        { precioBase: { $lte: 0 } }
      ]
    }).select('_id nombre precio precioBase');

    logger.info(`Productos encontrados para migrar: ${productosParaMigrar.length}`);

    if (productosParaMigrar.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay productos para migrar. Todos tienen precioBase válido.',
        data: {
          migrados: 0,
          errores: 0,
          total: 0,
          diagnostico: {
            totalProductos: todosProductos.length,
            conPrecioBase,
            sinPrecioBase
          }
        }
      });
    }

    // Migrar cada producto
    let migrados = 0;
    let errores = [];

    for (const producto of productosParaMigrar) {
      try {
        // Validar que precio existe y es válido
        if (!producto.precio || producto.precio <= 0) {
          throw new Error('Precio inválido o faltante');
        }

        // Calcular precioBase usando fórmula inversa
        // Si precio es el resultado de: precio = precioBase / (1 - tasa)
        // Entonces: precioBase = precio * (1 - tasa)
        const precioBase = producto.precio * (1 - TASA_MIGRACION);
        
        // Redondear HACIA ARRIBA a número entero (sin decimales)
        // Esto asegura que Mercado Pago nunca cobre más de lo esperado
        const precioBaseRedondeado = Math.ceil(precioBase);

        // Actualizar con runValidators: false para evitar conflictos con required
        const actualizado = await Producto.findByIdAndUpdate(
          producto._id,
          {
            $set: {
              precioBase: precioBaseRedondeado,
              tasaComisionAplicada: TASA_MIGRACION,
              fechaActualizacionPrecio: new Date()
            }
          },
          { 
            new: true,
            runValidators: false // No ejecutar validaciones para permitir actualización
          }
        );

        if (!actualizado) {
          throw new Error('Producto no encontrado');
        }

        migrados++;
        logger.info(`Producto migrado [${migrados}/${productosParaMigrar.length}]: ${producto.nombre} | Precio: $${producto.precio} → Base: $${precioBaseRedondeado}`);

      } catch (error) {
        errores.push({
          productoId: producto._id,
          nombre: producto.nombre,
          precioActual: producto.precio,
          error: error.message
        });
        logger.warn(`Error migrando producto ${producto.nombre}`, { message: error.message });
      }
    }

    logger.info(`Migración completada: ${migrados} exitosos, ${errores.length} errores`);

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
    logger.error('Error en migración de precios', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar migración de precios',
    });
  }
};

/**
 * ENDPOINT: Recalcular TODOS los precios de venta usando nueva tasa
 * POST /api/system-config/recalcular-precios
 * 
 * Cuando cambias la tasa de comisión de Mercado Pago,
 * esta función recalcula el precio de venta de TODOS los productos
 * manteniendo el precioBase intacto.
 * 
 * FLUJO:
 * 1. Obtiene configuración actual
 * 2. Busca TODOS los productos que tengan precioBase
 * 3. Recalcula: precio = Math.ceil(precioBase / (1 - tasa))
 * 4. Actualiza precio y tasaComisionAplicada
 */
export const recalcularPrecios = async (req, res) => {
  try {
    logger.info('Iniciando recalculación masiva de precios');
    
    // Obtener configuración actual
    const config = await SystemConfig.obtenerConfigActual();
    const tasaActual = config.comisiones.mercadoPago.tasaComision;
    
    logger.info(`Tasa actual de comisión: ${(tasaActual * 100).toFixed(2)}%`);
    
    // Buscar TODOS los productos que tengan precioBase
    const productosConPrecioBase = await Producto.find({
      precioBase: { $exists: true, $gt: 0 }
    }).select('_id nombre precioBase precio tasaComisionAplicada');

    logger.info(`Productos con precioBase encontrados: ${productosConPrecioBase.length}`);

    if (productosConPrecioBase.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay productos con precioBase para recalcular.',
        data: {
          recalculados: 0,
          errores: 0,
          total: 0
        }
      });
    }

    // Recalcular cada producto
    let recalculados = 0;
    let errores = [];

    for (const producto of productosConPrecioBase) {
      try {
        // 🧾 AUDITORÍA: Calcular precio con desglose completo para transparencia contable
        const breakdown = await config.calcularPrecioVenta(producto.precioBase);

        // Actualizar producto con precio y metadatos de auditoría
        const actualizado = await Producto.findByIdAndUpdate(
          producto._id,
          {
            $set: {
              precio: breakdown.precioVenta,
              precioCalculadoExacto: breakdown.precioExacto,
              ajusteRedondeo: breakdown.ajusteRedondeo,
              montoComision: breakdown.montoComision,
              tasaComisionAplicada: breakdown.tasaAplicada,
              fechaActualizacionPrecio: new Date()
            }
          },
          { 
            new: true,
            runValidators: false
          }
        );

        if (!actualizado) {
          throw new Error('Producto no encontrado');
        }

        recalculados++;
        logger.info(`Precio recalculado [${recalculados}/${productosConPrecioBase.length}]: ${producto.nombre} | Base: $${producto.precioBase} → Venta: $${breakdown.precioVenta}`);

      } catch (error) {
        errores.push({
          productoId: producto._id,
          nombre: producto.nombre,
          precioBase: producto.precioBase,
          error: error.message
        });
        logger.warn(`Error recalculando precio de ${producto.nombre}`, { message: error.message });
      }
    }

    logger.info(`Recalculación completada: ${recalculados} exitosos, ${errores.length} errores`);

    res.status(200).json({
      success: true,
      message: `Recalculación completada: ${recalculados} productos actualizados`,
      data: {
        recalculados,
        errores: errores.length,
        total: productosConPrecioBase.length,
        tasaAplicada: tasaActual,
        detalleErrores: errores.length > 0 ? errores : undefined
      }
    });

  } catch (error) {
    logger.error('Error en recalculación de precios', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar recalculación de precios',
    });
  }
};

/**
 * ENDPOINT: Limpiar estructura de precios en productos viejos
 * POST /api/system-config/limpiar-estructura-precios
 * 
 * Migración de datos: Mueve campos de pricing de propiedadesPersonalizadas
 * a nivel raíz, aplicando Math.ceil() para eliminar decimales.
 * 
 * FLUJO:
 * 1. Busca productos donde precioBase está en propiedadesPersonalizadas
 * 2. Mueve: precioBase, tasaComisionAplicada, fechaActualizacionPrecio a raíz
 * 3. Aplica Math.ceil() a precios para eliminar decimales
 * 4. PRESERVA propiedadesPersonalizadas (solo remueve esos 3 campos)
 * 5. Retorna resumen de migración
 */
export const limpiarEstructuraPrecios = async (req, res) => {
  try {
    logger.info('Iniciando limpieza de estructura de precios');

    // Buscar productos con campos en propiedadesPersonalizadas
    const productosConEstructuraVieja = await Producto.find({
      "propiedadesPersonalizadas.precioBase": { $exists: true }
    }).select('_id nombre precio propiedadesPersonalizadas');

    logger.info(`Productos con estructura vieja encontrados: ${productosConEstructuraVieja.length}`);

    if (productosConEstructuraVieja.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay productos con estructura vieja para limpiar.',
        data: {
          limpiados: 0,
          errores: 0,
          total: 0
        }
      });
    }

    let limpiados = 0;
    let errores = [];

    for (const producto of productosConEstructuraVieja) {
      try {
        const props = producto.propiedadesPersonalizadas;

        // Extraer valores de propiedadesPersonalizadas
        const precioBase = parseFloat(props.precioBase);
        const tasaComision = parseFloat(props.tasaComisionAplicada) || 0.0761;
        const fechaActualizacion = props.fechaActualizacionPrecio || new Date();
        const precioActual = parseFloat(producto.precio);

        // Aplicar Math.ceil() para eliminar decimales
        const precioBaseRedondeado = Math.ceil(precioBase);
        const precioRedondeado = Math.ceil(precioActual);

        // Crear nueva versión de propiedadesPersonalizadas SIN los 3 campos
        const propiedadesLimpias = { ...props };
        delete propiedadesLimpias.precioBase;
        delete propiedadesLimpias.tasaComisionAplicada;
        delete propiedadesLimpias.fechaActualizacionPrecio;

        // Actualizar producto
        const actualizado = await Producto.findByIdAndUpdate(
          producto._id,
          {
            $set: {
              precioBase: precioBaseRedondeado,
              precio: precioRedondeado,
              tasaComisionAplicada: tasaComision,
              fechaActualizacionPrecio: new Date(fechaActualizacion),
              propiedadesPersonalizadas: propiedadesLimpias
            }
          },
          { 
            new: true,
            runValidators: false
          }
        );

        if (!actualizado) {
          throw new Error('Producto no encontrado');
        }

        limpiados++;
        logger.info(`Estructura limpiada [${limpiados}/${productosConEstructuraVieja.length}]: ${producto.nombre} | Base: $${precioBase}→$${precioBaseRedondeado}, Venta: $${precioActual}→$${precioRedondeado}`);

      } catch (error) {
        errores.push({
          productoId: producto._id,
          nombre: producto.nombre,
          error: error.message
        });
        logger.warn(`Error limpiando estructura de ${producto.nombre}`, { message: error.message });
      }
    }

    logger.info(`Limpieza completada: ${limpiados} exitosos, ${errores.length} errores`);

    res.status(200).json({
      success: true,
      message: `Limpieza completada: ${limpiados} productos migrados`,
      data: {
        limpiados,
        errores: errores.length,
        total: productosConEstructuraVieja.length,
        detalleErrores: errores.length > 0 ? errores : undefined
      }
    });

  } catch (error) {
    logger.error('Error en limpieza de estructura de precios', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar limpieza de estructura',
    });
  }
};

export default {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreviewPrecio,
  migrarPrecios,
  recalcularPrecios,
  limpiarEstructuraPrecios
};
