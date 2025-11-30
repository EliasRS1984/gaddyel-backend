import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';
import { createOrderSchema, updateOrderStatusSchema, filterOrdersSchema } from '../validators/orderValidator.js';
import { getNextOrderNumber } from '../services/orderNumberService.js';
import logger from '../utils/logger.js';

/**
 * Crear nueva orden (público)
 * Frontend envía: items, datos del cliente
 */
export const createOrder = async (req, res) => {
    try {
        // Validar input
        const { error, value } = createOrderSchema.validate(req.body);
        if (error) {
            await logger.logCriticalError('ORDER_VALIDATION_FAILED', error.details[0].message, {
                input: req.body
            });
            return res.status(400).json({ error: error.details[0].message });
        }

        const { items, cliente } = value;

        // Validar y obtener productos
        const productosValidados = [];
        let total = 0;
        let subtotal = 0;

        for (const item of items) {
            const producto = await Producto.findById(item.productoId);
            
            if (!producto) {
                await logger.logCriticalError('PRODUCT_NOT_FOUND', `Producto ${item.productoId} no encontrado`, {
                    productoId: item.productoId
                });
                return res.status(404).json({ 
                    error: `Producto ${item.productoId} no encontrado` 
                });
            }

            // Validar stock
            if (producto.stock < item.cantidad) {
                await logger.logOrderOperation('ORDER_INSUFFICIENT_STOCK', null, {
                    productoId: producto._id,
                    productoNombre: producto.nombre,
                    required: item.cantidad,
                    available: producto.stock
                });
                return res.status(400).json({ 
                    error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}` 
                });
            }

            const itemSubtotal = producto.precio * item.cantidad;
            total += itemSubtotal;
            subtotal += itemSubtotal;

            productosValidados.push({
                productoId: producto._id,
                nombre: producto.nombre,
                cantidad: item.cantidad,
                precioUnitario: producto.precio,
                subtotal: itemSubtotal
            });
        }

        // Encontrar o crear cliente
        let clienteDoc = await Client.findOne({ email: cliente.email });
        
        if (!clienteDoc) {
            clienteDoc = new Client({
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp
            });
            await clienteDoc.save();
        } else {
            // Actualizar datos si existen
            clienteDoc.nombre = cliente.nombre;
            clienteDoc.whatsapp = cliente.whatsapp;
            clienteDoc.ultimaActividad = new Date();
            await clienteDoc.save();
        }

        // Generar número de orden secuencial
        const orderNumber = await getNextOrderNumber();

        // Crear orden
        const orden = new Order({
            orderNumber,
            clienteId: clienteDoc._id,
            items: productosValidados,
            total,
            subtotal,
            costoEnvio: 0,
            impuestos: 0,
            datosComprador: {
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp
            },
            historialEstados: [
                {
                    estado: 'pendiente',
                    nota: 'Orden creada, esperando pago'
                }
            ]
        });

        await orden.save();

        // Log de auditoría
        await logger.logOrderOperation('ORDER_CREATED', orden._id, {
            orderNumber: orden.orderNumber,
            clienteId: clienteDoc._id,
            total: orden.total,
            itemsCount: productosValidados.length
        });

        console.log('✅ Orden creada:', orden._id, `(${orderNumber})`);

        // Respuesta indica que necesita pagar con Mercado Pago
        res.status(201).json({
            ok: true,
            ordenId: orden._id,
            orderNumber: orden.orderNumber,
            mensaje: 'Orden creada. Proceder al pago con Mercado Pago',
            total: orden.total
        });

    } catch (err) {
        console.error('❌ Error creando orden:', err.message);
        await logger.logCriticalError('ORDER_CREATION_ERROR', err.message, {
            stack: err.stack,
            body: req.body
        });
        res.status(500).json({ error: 'Error al crear la orden' });
    }
};

/**
 * Obtener todas las órdenes (admin)
 */
export const getOrders = async (req, res) => {
    try {
        const { error, value } = filterOrdersSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { estadoPago, estadoPedido, clienteId, desde, hasta, pagina, limite } = value;

        // Construir filtro
        const filtro = {};
        if (estadoPago) filtro.estadoPago = estadoPago;
        if (estadoPedido) filtro.estadoPedido = estadoPedido;
        if (clienteId) filtro.clienteId = clienteId;
        
        if (desde || hasta) {
            filtro.fechaCreacion = {};
            if (desde) filtro.fechaCreacion.$gte = new Date(desde);
            if (hasta) filtro.fechaCreacion.$lte = new Date(hasta);
        }

        const skip = (pagina - 1) * limite;

        const ordenes = await Order.find(filtro)
            .populate('clienteId', 'nombre email whatsapp')
            .populate('items.productoId', 'nombre')
            .sort({ fechaCreacion: -1 })
            .skip(skip)
            .limit(limite);

        const total = await Order.countDocuments(filtro);

        res.json({
            ok: true,
            ordenes,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (err) {
        console.error('❌ Error obteniendo órdenes:', err.message);
        res.status(500).json({ error: 'Error al obtener órdenes' });
    }
};

/**
 * Obtener una orden por ID
 */
export const getOrderById = async (req, res) => {
    try {
        const orden = await Order.findById(req.params.id)
            .populate('clienteId')
            .populate('items.productoId');

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json({ ok: true, orden });

    } catch (err) {
        console.error('❌ Error obteniendo orden:', err.message);
        res.status(500).json({ error: 'Error al obtener la orden' });
    }
};

/**
 * Actualizar estado del pedido (admin)
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const { error, value } = updateOrderStatusSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { estadoPedido, notasInternas, fechaEntregaEstimada } = value;

        const orden = await Order.findById(req.params.id);
        if (!orden) {
            await logger.logCriticalError('ORDER_NOT_FOUND_UPDATE', `Orden ${req.params.id} no encontrada`, {
                orderId: req.params.id
            });
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        const estadoAnterior = orden.estadoPedido;

        // Actualizar estado
        orden.estadoPedido = estadoPedido;
        if (notasInternas) orden.notasInternas = notasInternas;
        if (fechaEntregaEstimada) orden.fechaEntregaEstimada = fechaEntregaEstimada;

        // Registrar en historial
        orden.historialEstados.push({
            estado: estadoPedido,
            nota: notasInternas || 'Sin notas',
            modifiedBy: req.user?.id || 'admin'
        });

        // Si es "entregado", registrar fecha real
        if (estadoPedido === 'entregado') {
            orden.fechaEntregaReal = new Date();
        }

        await orden.save();

        // Log de auditoría
        await logger.logOrderOperation('ORDER_STATUS_UPDATED', orden._id, {
            orderNumber: orden.orderNumber,
            estadoAnterior,
            estadoNuevo: estadoPedido,
            nota: notasInternas
        });

        console.log(`✅ Orden ${orden.orderNumber} actualizada a: ${estadoPedido}`);

        res.json({
            ok: true,
            mensaje: 'Orden actualizada',
            orden
        });

    } catch (err) {
        console.error('❌ Error actualizando orden:', err.message);
        await logger.logCriticalError('ORDER_UPDATE_ERROR', err.message, {
            orderId: req.params.id,
            stack: err.stack
        });
        res.status(500).json({ error: 'Error al actualizar la orden' });
    }
};

/**
 * Obtener órdenes de un cliente
 */
export const getClientOrders = async (req, res) => {
    try {
        const clienteId = req.params.clienteId;

        const ordenes = await Order.find({ clienteId })
            .populate('items.productoId', 'nombre')
            .sort({ fechaCreacion: -1 });

        res.json({
            ok: true,
            ordenes,
            total: ordenes.length
        });

    } catch (err) {
        console.error('❌ Error obteniendo órdenes del cliente:', err.message);
        res.status(500).json({ error: 'Error al obtener órdenes' });
    }
};

export default {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getClientOrders
};
