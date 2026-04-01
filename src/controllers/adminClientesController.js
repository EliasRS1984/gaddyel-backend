/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador para que los administradores gestionen los clientes registrados.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El administrador abre la sección "Clientes" en el panel.
 * 2. Se carga la lista de todos los clientes (con opción de buscar por nombre o email).
 * 3. Al hacer clic en un cliente, se ven sus datos completos y su historial de pedidos.
 * 4. El admin puede editar los datos de un cliente o eliminarlo si corresponde.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿La lista no carga? → Revisar listarClientes y la conexión a la base de datos
 * - ¿El historial de pedidos está vacío? → Revisar que las órdenes tengan clienteId correcto
 * - ¿No se puede editar el cliente? → Revisar que el token del admin sea válido (authMiddleware)
 * ======================================================
 */

import Client from '../models/Client.js';
import logger from '../utils/logger.js';
import { validateObjectId } from '../validators/noSqlInjectionValidator.js';

// ======== LISTAR CLIENTES ========
// Carga todos los clientes. Si el admin escribe en el buscador (?buscar=xxx),
// filtra por nombre o email. Incluye el resumen de compras de cada uno.
// ¿La lista no aparece? → Revisar listarClientes.
export const listarClientes = async (req, res, next) => {
    try {
        let filter = {};

        if (req.query.buscar) {
            // ======== PROTECCIÓN REDOS ========
            // Si el texto de búsqueda se usa directo como regex, un atacante puede
            // enviar patrones como ^(a+)+$ que consumen el 100% del CPU y cuelgan el servidor.
            // escapeRegex convierte caracteres especiales en literales seguros.
            const terminoBusqueda = req.query.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter = {
                $or: [
                    { nombre: { $regex: terminoBusqueda, $options: 'i' } },
                    { email:  { $regex: terminoBusqueda, $options: 'i' } }
                ]
            };
        }

        // ✅ RENDIMIENTO: .lean() devuelve objetos JS planos en lugar de documentos
        // Mongoose completos, lo que es más rápido para operaciones de solo lectura.
        const clientes = await Client.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .populate('historialPedidos', 'orderNumber total estadoPago fechaCreacion')
            .lean();

        res.json({
            exito: true,
            data: clientes,
            total: clientes.length
        });
    } catch (error) {
        next(error);
    }
};

// ======== VER DETALLE DE UN CLIENTE ========
// Carga los datos completos de un cliente y su historial de pedidos detallado.
// ¿La sección del cliente tarda en cargar? Revisa que el id sea válido.
export const obtenerCliente = async (req, res, next) => {
    try {
        validateObjectId(req.params.id, 'id');

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

        // Formatear el historial para mostrar información útil al admin
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
};

// ======== ACTUALIZAR DATOS DEL CLIENTE ========
// El admin puede corregir nombre, email, whatsapp o dirección de un cliente.
// ¿Aparece error "email ya registrado"? Significa que otro cliente usa ese email.
export const actualizarCliente = async (req, res, next) => {
    try {
        validateObjectId(req.params.id, 'id');

        const { nombre, email, whatsapp, domicilio, localidad, provincia, codigoPostal } = req.body;

        // Verificar que el nuevo email no esté siendo usado por otro cliente
        if (email) {
            const existeEmail = await Client.findOne({
                email: email.toLowerCase(),
                _id: { $ne: req.params.id }
            }).lean();

            if (existeEmail) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'Este email ya está registrado por otro cliente'
                });
            }
        }

        const datosActualizar = {};
        if (nombre !== undefined) datosActualizar.nombre = nombre;
        if (email !== undefined) datosActualizar.email = email.toLowerCase();
        if (whatsapp !== undefined) datosActualizar.whatsapp = whatsapp;
        if (domicilio !== undefined) datosActualizar.domicilio = domicilio;
        if (localidad !== undefined) datosActualizar.localidad = localidad;
        if (provincia !== undefined) datosActualizar.provincia = provincia;
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

        logger.info('Admin actualizó datos de cliente', { clienteId: req.params.id, adminId: req.user?.id });

        res.json({
            exito: true,
            data: cliente,
            mensaje: 'Cliente actualizado correctamente'
        });
    } catch (error) {
        next(error);
    }
};

// ======== ELIMINAR CLIENTE ========
// Borra permanentemente un cliente de la base de datos.
// ¿Error al eliminar? Revisa que el id del cliente sea válido y exista.
export const eliminarCliente = async (req, res, next) => {
    try {
        validateObjectId(req.params.id, 'id');

        const cliente = await Client.findByIdAndDelete(req.params.id);

        if (!cliente) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Cliente no encontrado'
            });
        }

        logger.info('Admin eliminó cliente', { clienteId: req.params.id, adminId: req.user?.id });

        res.json({
            exito: true,
            mensaje: 'Cliente eliminado correctamente'
        });
    } catch (error) {
        next(error);
    }
};
