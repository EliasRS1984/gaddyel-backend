import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';
import { createOrderSchema, updateOrderStatusSchema, filterOrdersSchema } from '../validators/orderValidator.js';

/**
 * Crear nueva orden (público)
 * Frontend envía: items, datos del cliente
 */
export const createOrder = async (req, res) => {
    try {
        // Validar input
        const { error, value } = createOrderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { items, cliente } = value;

        // Validar y obtener productos
        const productosValidados = [];
        let total = 0;

        for (const item of items) {
            const producto = await Producto.findById(item.productoId);
            
            if (!producto) {
                return res.status(404).json({ 
                    error: `Producto ${item.productoId} no encontrado` 
                });
            }

            // Validar stock
            if (producto.stock < item.cantidad) {
                return res.status(400).json({ 
                    error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}` 
                });
            }

            const subtotal = producto.precio * item.cantidad;
            total += subtotal;

            productosValidados.push({
                productoId: producto._id,
                nombre: producto.nombre,
                cantidad: item.cantidad,
                precioUnitario: producto.precio,
                subtotal
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

        // Crear orden
        const orden = new Order({
            clienteId: clienteDoc._id,
            items: productosValidados,
            total,
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

        console.log('✅ Orden creada:', orden._id);

        // Respuesta indica que necesita pagar con Mercado Pago
        res.status(201).json({
            ok: true,
            ordenId: orden._id,
            mensaje: 'Orden creada. Proceder al pago con Mercado Pago',
            total: orden.total,
            // El frontend usará este ID para solicitar el checkout URL
        });

    } catch (err) {
        console.error('❌ Error creando orden:', err.message);
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
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Actualizar estado
        orden.estadoPedido = estadoPedido;
        if (notasInternas) orden.notasInternas = notasInternas;
        if (fechaEntregaEstimada) orden.fechaEntregaEstimada = fechaEntregaEstimada;

        // Registrar en historial
        orden.historialEstados.push({
            estado: estadoPedido,
            nota: notasInternas || 'Sin notas'
        });

        // Si es "entregado", registrar fecha real
        if (estadoPedido === 'entregado') {
            orden.fechaEntregaReal = new Date();
        }

        await orden.save();

        console.log(`✅ Orden ${req.params.id} actualizada a: ${estadoPedido}`);

        res.json({
            ok: true,
            mensaje: 'Orden actualizada',
            orden
        });

    } catch (err) {
        console.error('❌ Error actualizando orden:', err.message);
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
