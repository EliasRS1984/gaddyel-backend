import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';
import AdminUser from '../models/AdminUser.js';
import MercadoPagoService from '../services/MercadoPagoService.js';
import { validateObjectId, validateObjectIdArray } from '../validators/noSqlInjectionValidator.js';

/**
 * ✅ Crear nueva orden con validación segura
 * Requiere: items validados, cliente con nombre y email
 * Retorna: orden creada con totales recalculados en servidor
 */
export const createOrder = async (req, res, next) => {
    try {
        console.log('📨 POST /pedidos/crear - Orden recibida');
        
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
        const validatedItems = items.map((item, idx) => {
            try {
                const productoId = validateObjectId(item.productoId, `items[${idx}].productoId`);
                const cantidad = Number(item.cantidad);
                
                if (!Number.isInteger(cantidad) || cantidad < 1) {
                    throw new Error(`items[${idx}].cantidad debe ser entero positivo`);
                }
                
                return { productoId, cantidad };
            } catch (error) {
                throw new Error(`items[${idx}]: ${error.message}`);
            }
        });

        console.log('✅ Validación de items pasada');

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

        // ✅ Calcular costo de envío basado en cantidad (REGLA DE NEGOCIO)
        const cantidadProductos = validatedItems.reduce((sum, item) => sum + item.cantidad, 0);
        const envioGratis = cantidadProductos >= 3;
        const costoEnvioCalculado = envioGratis ? 0 : 12000;
        const totalCalculado = subtotalCalculado + costoEnvioCalculado;

        console.log(`💰 Subtotal: ${subtotalCalculado}, Envío: ${costoEnvioCalculado}, Total: ${totalCalculado}`);

        // ✅ CRÍTICO: Validar que cliente no manipuló totales (previene fraude)
        if (totalRecibido !== undefined && Math.abs(totalRecibido - totalCalculado) > 1) {
            console.warn('⚠️ FRAUDE DETECTADO - Total manipulado:', {
                clientRecibido: totalRecibido,
                servidorCalculado: totalCalculado,
                diferencia: Math.abs(totalRecibido - totalCalculado)
            });
            
            return res.status(400).json({ 
                error: 'Total no coincide con cálculo servidor',
                serverTotal: totalCalculado,
                clientTotal: totalRecibido
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
            console.log('✅ Cliente autenticado actualizado:', clienteDoc._id);
        } else {
            // ✅ Búsqueda o creación de cliente invitado
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
                console.log('✅ Cliente nuevo creado (invitado):', clienteDoc._id);
            } else {
                clienteDoc.ultimaActividad = new Date();
                await clienteDoc.save();
                console.log('✅ Cliente existente encontrado:', clienteDoc._id);
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
            estadoPago: 'pending',
            estadoPedido: 'pendiente',
            datosComprador: {
                nombre,
                email,
                whatsapp: whatsapp || '',
                direccion: domicilio || '',
                ciudad: localidad || '',
                provincia: provincia || '',
                codigoPostal: codigoPostal || '',
                notasAdicionales: cliente.notasAdicionales || ''
            }
        });

        await orden.save();

        // ✅ Generar número de orden
        const orderNumber = 'G-' + orden._id.toString().slice(-6).toUpperCase();
        orden.orderNumber = orderNumber;
        await orden.save();

        console.log('✅ Orden creada:', orden._id, `(${orderNumber})`);

        // ✅ NUEVO: Crear preferencia de Mercado Pago inmediatamente
        let checkoutUrl = null;
        let sandboxCheckoutUrl = null;
        let preferenceId = null;

        try {
            console.log('🔵 Intentando crear preferencia de Mercado Pago...');
            console.log('   Orden ID:', orden._id);
            console.log('   Total:', totalCalculado);
            console.log('   Items:', productosValidados.length);
            
            const mpResponse = await MercadoPagoService.createPreference(orden);
            
            console.log('✅ Respuesta de MP:', {
                preferenceId: mpResponse.preferenceId,
                initPoint: mpResponse.initPoint ? 'presente' : 'undefined',
                sandboxInitPoint: mpResponse.sandboxInitPoint ? 'presente' : 'undefined'
            });
            
            checkoutUrl = mpResponse.initPoint;
            sandboxCheckoutUrl = mpResponse.sandboxInitPoint;
            preferenceId = mpResponse.preferenceId;
            console.log('✅ Preferencia MP creada:', preferenceId);
        } catch (mpError) {
            console.error('❌ Error creando preferencia MP:', mpError.message);
            console.error('   Stack:', mpError.stack);
            console.error('   El pago a través de Mercado Pago NO estará disponible');
            console.error('   La orden fue creada, pero sin redirección a MP');
            // No fallar si MP falla - continuar con confirmación
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
            console.log('📤 Retornando respuesta CON checkoutUrl');
        } else {
            console.log('📤 Retornando respuesta SIN checkoutUrl (MP no disponible)');
        }

        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * ✅ Obtener todas las órdenes (admin) con filtros y paginación
 * Uso de .lean() para mejor performance
 */
export const getOrders = async (req, res, next) => {
    try {
        console.log('📨 GET /pedidos - Solicitando lista de órdenes');
        console.log('🔐 Usuario autenticado:', req.user?.id || 'Desconocido');
        console.log('📋 Filtros:', req.query);
        
        const { estadoPago, estadoPedido, fechaDesde, fechaHasta, page = 1, limit = 20 } = req.query;
        
        // ✅ Construir filtro dinámico con validación
        const filter = {};
        
        if (estadoPago && ['pending', 'approved', 'refunded', 'cancelled'].includes(estadoPago)) {
            filter.estadoPago = estadoPago;
        }
        
        if (estadoPedido && ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'].includes(estadoPedido)) {
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

        console.log(`✅ ${ordenes.length} órdenes encontradas de ${total} total`);

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

/**
 * ✅ NUEVO: Obtener TODAS las órdenes sin paginación
 * Usado por Dashboard para estadísticas
 * @route GET /pedidos/all - Devuelve TODAS las órdenes sin paginación
 * @access Admin
 */
export const getOrdersNoPagination = async (req, res, next) => {
    try {
        console.log('📨 GET /pedidos/all - Solicitando TODAS las órdenes sin paginación');
        console.log('🔐 Usuario autenticado:', req.user?.email || 'Desconocido');

        // ✅ Importar el servicio
        const OrderService = (await import('../services/OrderService.js')).default;

        // ✅ Obtener TODAS las órdenes sin paginación
        const ordenes = await OrderService.getAllOrdersNoPagination(req.query);

        console.log(`✅ ${ordenes.length} órdenes retornadas sin paginación`);

        res.json({
            success: true,
            data: ordenes,
            total: ordenes.length
        });

    } catch (error) {
        next(error);
    }
};

/**
 * ✅ Obtener orden por ID (admin) con autorización
 * Usa .lean() para lectura optimizada
 */
export const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log(`📨 GET /pedidos/${id}`);

        // ✅ Validar ObjectId
        validateObjectId(id, 'id');

        const orden = await Order.findById(id)
            .lean();

        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        console.log(`✅ Orden encontrada: ${orden.orderNumber}`);
        res.json(orden);

    } catch (error) {
        next(error);
    }
};

/**
 * ✅ Actualizar estado de orden (admin)
 * Valida cambios de estado y registra historial
 */
export const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { estadoPedido, notasAdmin } = req.body;

        console.log(`📨 PUT /pedidos/${id}/estado - Nuevo estado: ${estadoPedido}`);

        // ✅ Validar ObjectId
        validateObjectId(id, 'id');

        // ✅ Validar estado permitido
        const estadosValidos = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
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

        console.log(`✅ Orden actualizada a estado: ${estadoPedido}`);
        res.json(orden);

    } catch (error) {
        next(error);
    }
};

/**
 * ✅ Obtener órdenes de un cliente autenticado
 * Solo el cliente puede ver sus propias órdenes (con autorización)
 */
export const getClientOrders = async (req, res, next) => {
    try {
        const clienteId = req.params.clienteId;
        console.log(`📨 GET /clientes/${clienteId}/ordenes`);

        // ✅ Validar ObjectId
        validateObjectId(clienteId, 'clienteId');

        // ✅ Verificar autorización: cliente solo ve sus propias órdenes (o admin)
        if (req.user?.clienteId && req.user.clienteId !== clienteId && req.user?.rol !== 'admin') {
            return res.status(403).json({ error: 'No autorizado para ver estas órdenes' });
        }

        const ordenes = await Order.find({ clienteId })
            .lean()
            .sort({ createdAt: -1 });

        console.log(`✅ ${ordenes.length} órdenes encontradas para cliente ${clienteId}`);

        res.json({
            ok: true,
            data: ordenes,
            total: ordenes.length
        });

    } catch (error) {
        next(error);
    }
};

/**
 * ✅ Eliminar una orden (requiere autenticación admin)
 * Valida autorización y registra en historial (soft delete + historial)
 */
export const deleteOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminUser = req.user; // Del middleware de autenticación

        console.log('🗑️  DELETE /pedidos/:id - Solicitud de eliminación');
        console.log('  - Orden ID:', id);
        console.log('  - Admin Usuario:', adminUser?.email || 'Sin email');

        // ✅ Validar ObjectId
        validateObjectId(id, 'id');

        // ✅ Verificar autorización (solo admin)
        if (adminUser?.rol !== 'admin') {
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

        console.log('✅ Orden cancelada y registrada:', id);

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

/**
 * ✅ Exportar default con todos los controladores
 */
export default {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getClientOrders,
    deleteOrder
};
