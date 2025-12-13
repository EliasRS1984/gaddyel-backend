import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';
import AdminUser from '../models/AdminUser.js';

/**
 * Crear nueva orden (público)
 * Frontend envía: items, datos del cliente
 */
export const createOrder = async (req, res) => {
    try {
        console.log('📨 POST /pedidos/crear - Orden recibida');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        
        // Obtener datos del request
        const { items, cliente, clienteId } = req.body;
        
        // Validación básica
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items es requerido y debe ser un array' });
        }
        if (!cliente || !cliente.nombre || !cliente.email) {
            return res.status(400).json({ error: 'Cliente es requerido con nombre y email' });
        }

        console.log('✅ Validación básica pasada');
        const { items: itemsList, cliente: clienteData, cantidadProductos, subtotal: subtotalRecibido, costoEnvio: costoEnvioRecibido } = req.body;

        // Validar y obtener productos
        const productosValidados = [];
        let total = 0;
        let subtotal = 0;

        for (const item of itemsList) {
            const producto = await Producto.findById(item.productoId);
            
            if (!producto) {
                console.error('❌ Producto no encontrado:', item.productoId);
                return res.status(404).json({ 
                    error: `Producto ${item.productoId} no encontrado` 
                });
            }

            // Validar stock
            if (producto.stock < item.cantidad) {
                console.warn('⚠️  Stock insuficiente:', {
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
            const cantidadUnidadesPorItem = producto.cantidadUnidades || 1;
            
            total += itemSubtotal;
            subtotal += itemSubtotal;

            productosValidados.push({
                productoId: producto._id,
                nombre: producto.nombre,
                cantidad: item.cantidad,
                cantidadUnidades: cantidadUnidadesPorItem,
                precioUnitario: producto.precio,
                subtotal: itemSubtotal
            });
        }

        // Calcular cantidad de solicitudes (TOTAL de veces que se agregaron productos)
        const cantidadSolicitudes = itemsList.reduce((sum, item) => sum + item.cantidad, 0);
        console.log(`📦 Cantidad de solicitudes: ${cantidadSolicitudes}`);

        // Calcular costo de envío basado en cantidad de solicitudes (REGLA DE NEGOCIO)
        const envioGratis = cantidadSolicitudes >= 3;  // 3 o más solicitudes = gratis
        const costoEnvioCalculado = envioGratis ? 0 : 12000;
        
        // Validar contra el valor recibido del frontend (seguridad)
        if (costoEnvioRecibido !== undefined && costoEnvioRecibido !== costoEnvioCalculado) {
            console.warn(`⚠️ Costo de envío recibido (${costoEnvioRecibido}) no coincide con calculado (${costoEnvioCalculado}). Usando calculado.`);
        }

        const costoEnvioFinal = costoEnvioCalculado;
        const totalFinal = subtotal + costoEnvioFinal;

        console.log(`💰 Subtotal: ${subtotal}`);
        console.log(`📦 Envío: ${costoEnvioFinal} (${envioGratis ? 'GRATIS' : '$12.000'})`);
        console.log(`💵 Total: ${totalFinal}`);

        // Encontrar o crear cliente
        let clienteDoc;
        
        // Si viene clienteId (usuario autenticado), usar ese cliente
        if (clienteId) {
            clienteDoc = await Client.findById(clienteId);
            
            if (!clienteDoc) {
                console.error('❌ Cliente autenticado no encontrado:', clienteId);
                return res.status(404).json({ error: 'Cliente no encontrado' });
            }
            
            // Actualizar datos del cliente con la información del checkout
            clienteDoc.nombre = clienteData.nombre;
            clienteDoc.whatsapp = clienteData.whatsapp || clienteDoc.whatsapp;
            
            // Actualizar campos nuevos (domicilio, localidad, provincia)
            if (clienteData.domicilio) clienteDoc.domicilio = clienteData.domicilio;
            if (clienteData.localidad) clienteDoc.localidad = clienteData.localidad;
            if (clienteData.provincia) clienteDoc.provincia = clienteData.provincia;
            if (clienteData.codigoPostal) clienteDoc.codigoPostal = clienteData.codigoPostal;
            
            // Mantener campos legacy para compatibilidad
            if (clienteData.direccion) clienteDoc.direccion = clienteData.direccion;
            if (clienteData.ciudad) clienteDoc.ciudad = clienteData.ciudad;
            
            clienteDoc.ultimaActividad = new Date();
            await clienteDoc.save();
            
            console.log('✅ Cliente autenticado actualizado:', clienteDoc._id);
        } else {
            // Si no viene clienteId, buscar por email o crear nuevo (checkout de invitado)
            clienteDoc = await Client.findOne({ email: clienteData.email });
            
            if (!clienteDoc) {
                clienteDoc = new Client({
                    nombre: clienteData.nombre,
                    email: clienteData.email,
                    whatsapp: clienteData.whatsapp || '',
                    domicilio: clienteData.domicilio || clienteData.direccion || '',
                    localidad: clienteData.localidad || clienteData.ciudad || '',
                    provincia: clienteData.provincia || '',
                    direccion: clienteData.direccion || '',
                    ciudad: clienteData.ciudad || '',
                    codigoPostal: clienteData.codigoPostal || ''
                });
                await clienteDoc.save();
                console.log('✅ Cliente nuevo creado (invitado):', clienteDoc._id);
            } else {
                // Actualizar datos si existen
                clienteDoc.nombre = clienteData.nombre;
                clienteDoc.whatsapp = clienteData.whatsapp || clienteDoc.whatsapp;
                
                // Actualizar campos nuevos (domicilio, localidad, provincia)
                if (clienteData.domicilio) clienteDoc.domicilio = clienteData.domicilio;
                if (clienteData.localidad) clienteDoc.localidad = clienteData.localidad;
                if (clienteData.provincia) clienteDoc.provincia = clienteData.provincia;
                if (clienteData.codigoPostal) clienteDoc.codigoPostal = clienteData.codigoPostal;
                
                // Mantener campos legacy
                if (clienteData.direccion) clienteDoc.direccion = clienteData.direccion;
                if (clienteData.ciudad) clienteDoc.ciudad = clienteData.ciudad;
                
                clienteDoc.ultimaActividad = new Date();
                await clienteDoc.save();
                console.log('✅ Cliente existente actualizado (invitado):', clienteDoc._id);
            }
        }

        // Crear orden primero sin orderNumber
        const ordenTemp = new Order({
            clienteId: clienteDoc._id,
            items: productosValidados,
            total: totalFinal,
            subtotal: subtotal,
            costoEnvio: costoEnvioFinal,
            cantidadProductos: cantidadSolicitudes,  // Guardar cantidad de solicitudes (items.length)
            impuestos: 0,
            datosComprador: {
                nombre: clienteData.nombre,
                email: clienteData.email,
                whatsapp: clienteData.whatsapp || '',
                direccion: clienteData.direccion,
                ciudad: clienteData.ciudad,
                provincia: clienteData.provincia || '',
                codigoPostal: clienteData.codigoPostal,
                notasAdicionales: clienteData.notasAdicionales || ''
            },
            diasProduccion: 20, // Por defecto 20 días
            fechaEnvioEstimada: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Calcula automáticamente +20 días
            historialEstados: [
                {
                    estado: 'pendiente',
                    nota: 'Orden creada, esperando pago'
                }
            ]
        });

        await ordenTemp.save();

        // Generar orderNumber basado en el ID de la orden (determinístico)
        const orderNumber = 'G-' + ordenTemp._id.toString().slice(-6).toUpperCase();
        ordenTemp.orderNumber = orderNumber;
        await ordenTemp.save();

        const orden = ordenTemp;

        console.log('✅ Orden creada:', orden._id, `(${orderNumber})`);
        console.log('📦 Productos en orden:', productosValidados.length);

        // Actualizar historial del cliente y estadísticas
        try {
            await Client.updateOne(
                { _id: clienteDoc._id },
                {
                    $push: { historialPedidos: orden._id },
                    $inc: { totalPedidos: 1, totalGastado: orden.total },
                    $set: { ultimaActividad: new Date() }
                }
            );
            // Añadir dirección usada en este checkout
            const direccionActual = {
                domicilio: clienteData.domicilio || clienteData.direccion || '',
                localidad: clienteData.localidad || clienteData.ciudad || '',
                provincia: clienteData.provincia || '',
                codigoPostal: clienteData.codigoPostal || '',
                predeterminada: clienteDoc.direcciones.length === 0, // Primera dirección es predeterminada
                etiqueta: clienteDoc.direcciones.length === 0 ? 'Principal' : 'Envío '
            };
            if (direccionActual.domicilio) {
                await Client.updateOne(
                    { _id: clienteDoc._id },
                    { $addToSet: { direcciones: direccionActual } }
                );
            }
        } catch (e) {
            console.warn('⚠️ No se pudo actualizar historial del cliente:', e.message);
        }

        // Respuesta con información completa de envío Y datos del comprador
        res.status(201).json({
            ok: true,
            ordenId: orden._id,
            orderNumber: orden.orderNumber,
            mensaje: 'Orden creada exitosamente',
            subtotal: orden.subtotal,
            costoEnvio: orden.costoEnvio,
            cantidadProductos: orden.cantidadProductos,
            total: orden.total,
            items: productosValidados,
            datosComprador: orden.datosComprador,
            envio: {
                diasProduccion: orden.diasProduccion,
                fechaEnvioEstimada: orden.fechaEnvioEstimada,
                mensaje: `Tu pedido será enviado en aproximadamente ${orden.diasProduccion} días corridos`
            }
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
        console.log('📨 GET /pedidos - Solicitando lista de órdenes');
        console.log('🔐 Usuario autenticado:', req.user?.id || 'Desconocido');
        console.log('📋 Filtros:', req.query);
        
        // Construir filtro dinámico
        const filter = {};
        
        // Filtrar por estado de pago si se proporciona
        if (req.query.estadoPago) {
            filter.estadoPago = req.query.estadoPago;
        }
        
        // Filtrar por estado de pedido si se proporciona
        if (req.query.estadoPedido) {
            filter.estadoPedido = req.query.estadoPedido;
        }
        
        // Filtrar por rango de fechas si se proporciona
        if (req.query.fechaDesde || req.query.fechaHasta) {
            filter.fechaCreacion = {};
            if (req.query.fechaDesde) {
                filter.fechaCreacion.$gte = new Date(req.query.fechaDesde);
            }
            if (req.query.fechaHasta) {
                filter.fechaCreacion.$lte = new Date(req.query.fechaHasta);
            }
        }
        
        const ordenes = await Order.find(filter)
            .populate('clienteId', 'nombre email whatsapp')
            .populate('items.productoId', 'nombre precio')
            .sort({ fechaCreacion: -1 })
            .limit(200);

        console.log(`✅ ${ordenes.length} órdenes encontradas`);

        res.json({ 
            success: true,
            data: ordenes,
            cantidad: ordenes.length
        });

    } catch (err) {
        console.error('❌ Error obteniendo órdenes:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({ 
            error: 'Error al obtener órdenes',
            mensaje: err.message 
        });
    }
};

/**
 * Obtener orden por ID (admin)
 */
export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📨 GET /pedidos/${id}`);

        const orden = await Order.findById(id)
            .populate('clienteId')
            .populate('items.productoId');

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json(orden);

    } catch (err) {
        console.error('❌ Error obteniendo orden:', err.message);
        res.status(500).json({ 
            error: 'Error al obtener orden',
            mensaje: err.message 
        });
    }
};

/**
 * Actualizar estado de orden (admin)
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estadoPedido, notasAdmin, fechaEntregaEstimada } = req.body;

        console.log(`📨 PUT /pedidos/${id}/estado - Nuevo estado: ${estadoPedido}`);

        const orden = await Order.findByIdAndUpdate(
            id,
            {
                estadoPedido,
                notasAdmin,
                fechaEntregaEstimada
            },
            { new: true }
        ).populate('clienteId');

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json(orden);

    } catch (err) {
        console.error('❌ Error actualizando orden:', err.message);
        res.status(500).json({ 
            error: 'Error al actualizar orden',
            mensaje: err.message 
        });
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

/**
 * Eliminar una orden (requiere autenticación y contraseña del admin)
 */
export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const adminUser = req.user; // Del middleware de autenticación

        console.log('🗑️  DELETE /pedidos/:id - Solicitud de eliminación');
        console.log('  - Orden ID:', id);
        console.log('  - Admin Usuario:', adminUser?.email || 'Sin email');

        // Obtener la orden
        const order = await Order.findById(id);
        if (!order) {
            console.log('❌ Orden no encontrada:', id);
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Registrar la eliminación en el historial
        await Order.findByIdAndUpdate(id, {
            $push: {
                historialEstados: {
                    estado: 'cancelado',
                    nota: `Orden eliminada por administrador ${adminUser?.email} - ${new Date().toISOString()}`,
                    modifiedBy: adminUser?.email || 'admin'
                }
            }
        });

        // Eliminar la orden
        await Order.findByIdAndDelete(id);

        console.log('✅ Orden eliminada exitosamente:', id);

        res.json({
            success: true,
            message: 'Orden eliminada correctamente',
            ordenId: id
        });

    } catch (err) {
        console.error('❌ Error eliminando orden:', err.message);
        res.status(500).json({ error: 'Error al eliminar la orden: ' + err.message });
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
