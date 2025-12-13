import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Client from '../models/Client.js';

const router = express.Router();

/**
 * GET /api/admin/clientes
 * Obtener lista de todos los clientes registrados
 * Soporta búsqueda por nombre o email: ?buscar=algo
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        let filter = {};
        
        // Búsqueda por nombre o email si se proporciona
        if (req.query.buscar) {
            filter = {
                $or: [
                    { nombre: { $regex: req.query.buscar, $options: 'i' } },
                    { email: { $regex: req.query.buscar, $options: 'i' } }
                ]
            };
        }
        
        const clientes = await Client.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .populate('historialPedidos', 'orderNumber total estadoPago fechaCreacion');
        
        res.json({
            exito: true,
            data: clientes,
            total: clientes.length
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/clientes/:id
 * Obtener un cliente específico CON historial de pedidos poblado
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const cliente = await Client.findById(req.params.id)
            .select('-password')
            .populate({
                path: 'historialPedidos',
                select: 'orderNumber total estadoPago estadoPedido fechaCreacion diasProduccion fechaEnvioEstimada cantidadProductos items datosComprador',
                options: { sort: { fechaCreacion: -1 } }
            });
        
        if (!cliente) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Cliente no encontrado'
            });
        }
        
        // Enriquecer historial con detalles de productos
        const historialEnriquecido = cliente.historialPedidos.map(orden => ({
            _id: orden._id,
            orderNumber: orden.orderNumber,
            total: orden.total,
            estadoPago: orden.estadoPago,
            estadoPedido: orden.estadoPedido,
            fechaCreacion: orden.fechaCreacion,
            diasProduccion: orden.diasProduccion,
            fechaEnvioEstimada: orden.fechaEnvioEstimada,
            cantidadProductos: orden.cantidadProductos,
            cantidad_items: orden.items?.length || 0,
            detalles: orden.items?.map(item => ({
                nombre: item.nombre,
                cantidad: item.cantidad,
                cantidadUnidades: item.cantidadUnidades,
                subtotal: item.subtotal
            })) || []
        }));
        
        res.json({
            exito: true,
            data: {
                ...cliente.toObject(),
                historialPedidos: historialEnriquecido
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/clientes/:id
 * Actualizar información del cliente
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { nombre, email, whatsapp, domicilio, localidad, provincia, codigoPostal, direccion, ciudad } = req.body;
        
        // Validar que el email no esté duplicado
        if (email) {
            const existeEmail = await Client.findOne({
                email: email.toLowerCase(),
                _id: { $ne: req.params.id }
            });
            
            if (existeEmail) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'Este email ya está registrado'
                });
            }
        }
        
        const datosActualizar = {};
        if (nombre !== undefined) datosActualizar.nombre = nombre;
        if (email !== undefined) datosActualizar.email = email.toLowerCase();
        if (whatsapp !== undefined) datosActualizar.whatsapp = whatsapp;
        // Nuevos campos preferidos
        if (domicilio !== undefined) datosActualizar.domicilio = domicilio;
        if (localidad !== undefined) datosActualizar.localidad = localidad;
        if (provincia !== undefined) datosActualizar.provincia = provincia;
        // Campos legacy para compatibilidad
        if (direccion !== undefined) datosActualizar.direccion = direccion;
        if (ciudad !== undefined) datosActualizar.ciudad = ciudad;
        if (codigoPostal !== undefined) datosActualizar.codigoPostal = codigoPostal;
        
        const cliente = await Client.findByIdAndUpdate(
            req.params.id,
            datosActualizar,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!cliente) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Cliente no encontrado'
            });
        }
        
        res.json({
            exito: true,
            data: cliente,
            mensaje: 'Cliente actualizado correctamente'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/clientes/:id
 * Eliminar un cliente
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const cliente = await Client.findByIdAndDelete(req.params.id);
        
        if (!cliente) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Cliente no encontrado'
            });
        }
        
        res.json({
            exito: true,
            mensaje: 'Cliente eliminado correctamente',
            data: cliente
        });
    } catch (error) {
        next(error);
    }
});

export default router;
