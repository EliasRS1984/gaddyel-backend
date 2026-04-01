/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de pedidos. Maneja todo el ciclo de vida de
 * un pedido: creación, listado, actualización de estado y eliminación.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El cliente arma su carrito y envía los items al endpoint createOrder.
 * 2. El servidor valida los items, recalcula los totales y crea el pedido.
 * 3. Inmediatamente se crea la preferencia de Mercado Pago para el pago.
 * 4. El admin puede ver todos los pedidos con filtros y cambiar sus estados.
 * 5. Los estados del pedido son: en_produccion → enviado → entregado.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El pedido no se crea? → Revisar createOrder (validación de items y cliente)
 * - ¿Los totales no coinciden? → El servidor recalcula siempre; nunca confía en el cliente
 * - ¿El admin no ve el pedido? → Revisar getOrders (los "pending" se ocultan por defecto)
 * - ¿No se puede cambiar el estado? → Revisar updateOrderStatus (estados válidos)
 * - ¿El botón de pago no aparece? → Revisar que MercadoPagoService funcione correctamente
 * ======================================================
 */

import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';
import MercadoPagoService from '../services/MercadoPagoService.js';
import OrderService from '../services/OrderService.js';
import { validateObjectId, validateObjectIdArray } from '../validators/noSqlInjectionValidator.js';
import SystemConfig from '../models/SystemConfig.js';
import logger from '../utils/logger.js';
import { getNextOrderNumber } from '../services/orderNumberService.js';

// ======== CREAR PEDIDO ========
export const createOrder = async (req, res, next) => {
    try {
        const { items, cliente, clienteId, total: totalRecibido } = req.body;
        
        // ✅ Validación básica
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items es requerido y debe ser un array' });
        }
        if (!cliente || typeof cliente !== 'object') {
            return res.status(400).json({ error: 'Cliente debe ser objeto' });
        }

        const { nombre, email, whatsapp, domicilio, localidad, provincia, codigoPostal } = cliente;
        
        // ✅ Validar datos del cliente
        if (!nombre || typeof nombre !== 'string' || nombre.length < 2) {
            return res.status(400).json({ error: 'Nombre debe ser string de 2+ caracteres' });
        }
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // ✅ Validar y normalizar items con protección NoSQL Injection
        let validatedItems;
        try {
            validatedItems = items.map((item, idx) => {
                const productoId = validateObjectId(item.productoId, `items[${idx}].productoId`);
                const cantidad = Number(item.cantidad);
                
                if (!Number.isInteger(cantidad) || cantidad < 1) {
                    throw new Error(`items[${idx}].cantidad debe ser entero positivo`);
                }
                
                return { productoId, cantidad };
            });
        } catch (error) {
            logger.warn('Validación de items fallida', { message: error.message });
            return res.status(400).json({ error: error.message });
        }

        // ✅ Obtener productos con UNA sola query (evita N queries)
        const productIds = validatedItems.map(item => item.productoId);
        const productos = await Producto.find({ 
            _id: { $in: productIds } 
        }).lean(); // ✅ .lean() para mejor performance

        if (productos.length !== productIds.length) {
            return res.status(404).json({ error: 'Uno o más productos no encontrados' });
        }

        // ✅ Validar productos y calcular totales EN SERVIDOR (sin restricciones de stock)
        const productosValidados = [];
        let subtotalCalculado = 0;

        for (const item of validatedItems) {
            const producto = productos.find(p => p._id.toString() === item.productoId);
            
            if (!producto) {
                return res.status(404).json({ error: `Producto ${item.productoId} no encontrado` });
            }

            // ℹ️ Cada solicitud (item del carrito) tiene su cantidad independiente
            // Sin validación de stock global - la cantidad es parte de la solicitud específica
            const itemSubtotal = producto.precio * item.cantidad;
            subtotalCalculado += itemSubtotal;

            productosValidados.push({
                productoId: producto._id,
                nombre: producto.nombre,
                cantidad: item.cantidad,
                precioUnitario: producto.precio,
                subtotal: itemSubtotal
            });
        }

        // ✅ Obtener configuración del sistema para cálculo de envío
        const systemConfig = await SystemConfig.obtenerConfigActual();
        
        // ✅ Calcular costo de envío basado en configuración global
        const cantidadProductos = validatedItems.reduce((sum, item) => sum + item.cantidad, 0);
        const costoEnvioCalculado = systemConfig.calcularEnvio(cantidadProductos);
        const totalCalculado = subtotalCalculado + costoEnvioCalculado;

        // SEGURIDAD: Validar que el cliente no manipuló el total en su solicitud.
        // Si la diferencia es mayor a $1 (margen de redondeo), rechazar el pedido.
        // No se expone el total calculado para no darle información al atacante.
        if (totalRecibido !== undefined && Math.abs(totalRecibido - totalCalculado) > 1) {
            return res.status(400).json({
                error: 'El total enviado no coincide con el calculado por el servidor'
            });
        }

        // ✅ Validar o crear cliente autenticado
        let clienteDoc;
        
        if (clienteId) {
            // ✅ Validar clienteId
            validateObjectId(clienteId, 'clienteId');
            clienteDoc = await Client.findById(clienteId);
            
            if (!clienteDoc) {
                return res.status(404).json({ error: 'Cliente autenticado no encontrado' });
            }
            
            // ✅ Actualizar datos del cliente
            clienteDoc.nombre = nombre;
            clienteDoc.email = email;
            clienteDoc.whatsapp = whatsapp || clienteDoc.whatsapp;
            if (domicilio) clienteDoc.domicilio = domicilio;
            if (localidad) clienteDoc.localidad = localidad;
            if (provincia) clienteDoc.provincia = provincia;
            if (codigoPostal) clienteDoc.codigoPostal = codigoPostal;
            clienteDoc.ultimaActividad = new Date();
            
            await clienteDoc.save();
        } else {
            clienteDoc = await Client.findOne({ email });
            
            if (!clienteDoc) {
                clienteDoc = new Client({
                    nombre,
                    email,
                    whatsapp: whatsapp || '',
                    domicilio: domicilio || '',
                    localidad: localidad || '',
                    provincia: provincia || '',
                    codigoPostal: codigoPostal || ''
                });
                await clienteDoc.save();
            } else {
                clienteDoc.ultimaActividad = new Date();
                await clienteDoc.save();
            }
        }

        // ✅ Crear orden con totales recalculados
        const orden = new Order({
            clienteId: clienteDoc._id,
            items: productosValidados,
            subtotal: subtotalCalculado,
            costoEnvio: costoEnvioCalculado,
            total: totalCalculado,
            cantidadProductos,
            estadoPago: 'pending', // Esperando confirmación de pago de MP
            // estadoPedido usa default del modelo: 'en_produccion'
            datosComprador: {
                nombre,
                email,
                whatsapp: whatsapp || '',
                domicilio: domicilio || '',
                localidad: localidad || '',
                provincia: provincia || '',
                codigoPostal: codigoPostal || '',
                notasAdicionales: cliente.notasAdicionales || ''
            }
        });

        // 🧾 AUDITORÍA: Calcular desglose contable 
        // Incluye: precio base items, envío (con recargo MP incorporado), redondeo, comisión MP
        const desglose = systemConfig.calcularDesgloceOrden(totalCalculado, productosValidados, costoEnvioCalculado);
        orden.desglose = {
            precioBasePorItem: desglose.precioBasePorItem,
            costoEnvio: desglose.costoEnvio,
            ajusteRedondeoTotal: desglose.ajusteRedondeoTotal,
            comisionMercadoPago: desglose.comisionMercadoPago
        };

        await orden.save();

        // Asignar número de pedido secuencial (G-001, G-002, ...)
        const orderNumber = await getNextOrderNumber();
        orden.orderNumber = orderNumber;
        await orden.save();

        logger.info('Pedido creado', { orderId: orden._id, orderNumber });

        // ✅ NUEVO: Crear preferencia de Mercado Pago inmediatamente
        let checkoutUrl = null;
        let sandboxCheckoutUrl = null;
        let preferenceId = null;

        try {
            const mpResponse = await MercadoPagoService.createPreference(orden);
            checkoutUrl = mpResponse.initPoint;
            sandboxCheckoutUrl = mpResponse.sandboxInitPoint;
            preferenceId = mpResponse.preferenceId;
        } catch (mpError) {
            logger.error('Error creando preferencia de MP — orden guardada sin enlace de pago', { orderId: orden._id, message: mpError.message });
        }

        const response = {
            ok: true,
            ordenId: orden._id,
            orderNumber,
            subtotal: subtotalCalculado,
            costoEnvio: costoEnvioCalculado,
            total: totalCalculado,
            cantidadProductos
        };

        // ✅ Incluir datos de Mercado Pago si se creó la preferencia
        if (checkoutUrl) {
            response.checkoutUrl = checkoutUrl;
            response.sandboxCheckoutUrl = sandboxCheckoutUrl;
            response.preferenceId = preferenceId;
        }

        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
};

// ======== LISTAR PEDIDOS (ADMIN) ========
export const getOrders = async (req, res, next) => {
    try {
        const { estadoPago, estadoPedido, fechaDesde, fechaHasta, page = 1, limit = 20 } = req.query;
        
        // ✅ Construir filtro dinámico con validación
        const filter = {};
        
        // 🔒 FILTRO CRÍTICO: Por defecto, EXCLUIR órdenes "pending"
        // RAZÓN: Órdenes pending son creadas ANTES del pago (checkout)
        // Si el usuario cancela en MP, el webhook las elimina, pero mientras tanto
        // el admin las vería como "órdenes reales" cuando no lo son.
        // SOLO mostrar pending si el admin EXPLÍCITAMENTE lo solicita con ?estadoPago=pending
        if (estadoPago && ['pending', 'approved', 'refunded', 'cancelled'].includes(estadoPago)) {
            filter.estadoPago = estadoPago;
        } else if (!estadoPago) {
            // ✅ Por defecto: Solo órdenes con pago CONFIRMADO (aprobado, reembolsado, o cancelado con registro)
            // Esto excluye automáticamente las órdenes "pending" que el usuario abandonó
            filter.estadoPago = { $ne: 'pending' };
        }
        
        // ✅ Validar estado del pedido (solo 3 estados permitidos)
        if (estadoPedido && ['en_produccion', 'enviado', 'entregado'].includes(estadoPedido)) {
            filter.estadoPedido = estadoPedido;
        }
        
        if (fechaDesde || fechaHasta) {
            filter.createdAt = {};
            if (fechaDesde) {
                try {
                    filter.createdAt.$gte = new Date(fechaDesde);
                } catch (e) {
                    return res.status(400).json({ error: 'fechaDesde inválida' });
                }
            }
            if (fechaHasta) {
                try {
                    filter.createdAt.$lte = new Date(fechaHasta);
                } catch (e) {
                    return res.status(400).json({ error: 'fechaHasta inválida' });
                }
            }
        }
        
        // ✅ Paginación segura
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;
        
        // ✅ Usar .lean() para lectura rápida (sin populate para evitar errores de referencia)
        const ordenes = await Order.find(filter)
            .lean()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await Order.countDocuments(filter);

        res.json({ 
            success: true,
            data: ordenes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        next(error);
    }
};

// ======== TODOS LOS PEDIDOS SIN PAGINACIÓN (DASHBOARD) ========
export const getOrdersNoPagination = async (req, res, next) => {
    try {
        const ordenes = await OrderService.getAllOrdersNoPagination(req.query);

        res.json({
            success: true,
            data: ordenes,
            total: ordenes.length
        });

    } catch (error) {
        next(error);
    }
};

// ======== OBTENER UN PEDIDO POR ID (ADMIN) ========
export const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;

        validateObjectId(id, 'id');

        const orden = await Order.findById(id).lean();

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json(orden);

    } catch (error) {
        next(error);
    }
};

// ======== ACTUALIZAR ESTADO DEL PEDIDO (ADMIN) ========
export const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { estadoPedido, notasAdmin } = req.body;

        validateObjectId(id, 'id');

        const estadosValidos = ['en_produccion', 'enviado', 'entregado'];
        if (!estadosValidos.includes(estadoPedido)) {
            return res.status(400).json({ 
                error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}` 
            });
        }

        // ✅ Actualizar y registrar en historial
        const orden = await Order.findByIdAndUpdate(
            id,
            {
                estadoPedido,
                notasAdmin: notasAdmin || '',
                $push: {
                    historialEstados: {
                        estado: estadoPedido,
                        nota: notasAdmin || `Estado actualizado a ${estadoPedido}`,
                        modifiedBy: req.user?.email || 'admin',
                        timestamp: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        ).lean();

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        logger.info('Estado de pedido actualizado', { orderId: id, nuevoEstado: estadoPedido });
        res.json(orden);

    } catch (error) {
        next(error);
    }
};

// ======== PEDIDOS DE UN CLIENTE AUTENTICADO ========
export const getClientOrders = async (req, res, next) => {
    try {
        const clienteId = req.params.clienteId;

        validateObjectId(clienteId, 'clienteId');

        if (req.user?.clienteId && req.user.clienteId !== clienteId && req.user?.rol !== 'admin') {
            return res.status(403).json({ error: 'No autorizado para ver estas órdenes' });
        }

        const ordenes = await Order.find({ clienteId })
            .lean()
            .sort({ createdAt: -1 });

        res.json({
            ok: true,
            data: ordenes,
            total: ordenes.length
        });

    } catch (error) {
        next(error);
    }
};

// ======== ELIMINAR PEDIDO (ADMIN) ========
export const deleteOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminUser = req.user;

        validateObjectId(id, 'id');

        if (!adminUser || (adminUser.rol !== 'admin' && adminUser.rol !== 'Admin')) {
            logger.security('Intento de eliminar pedido sin autorización', { orderId: id });
            return res.status(403).json({ error: 'Solo administradores pueden eliminar órdenes' });
        }

        // ✅ Obtener orden antes de eliminar
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // ✅ Actualizar estado a "cancelado" y registrar eliminación en historial
        await Order.findByIdAndUpdate(id, {
            estadoPedido: 'cancelado',
            estadoPago: 'cancelled',
            $push: {
                historialEstados: {
                    estado: 'cancelado',
                    nota: `Orden eliminada por administrador ${adminUser?.email} en ${new Date().toISOString()}`,
                    modifiedBy: adminUser?.email || 'admin',
                    timestamp: new Date()
                }
            }
        });

        logger.info('Pedido cancelado por admin', { orderId: id, orderNumber: order.orderNumber });

        res.json({
            success: true,
            message: 'Orden cancelada correctamente',
            ordenId: id,
            orderNumber: order.orderNumber
        });

    } catch (error) {
        next(error);
    }
};

export default {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getClientOrders,
    deleteOrder
};
