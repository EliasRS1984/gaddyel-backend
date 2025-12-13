import Client from '../models/Client.js';
import Order from '../models/Order.js';
import { clientSchema, filterClientsSchema } from '../validators/clientValidator.js';

/**
 * Obtener todos los clientes (admin)
 */
export const getClients = async (req, res) => {
    try {
        const { error, value } = filterClientsSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { buscar, orderBy, orden, pagina, limite } = value;

        // Construir filtro
        const filtro = { activo: true };
        if (buscar) {
            filtro.$or = [
                { nombre: { $regex: buscar, $options: 'i' } },
                { email: { $regex: buscar, $options: 'i' } },
                { whatsapp: { $regex: buscar, $options: 'i' } }
            ];
        }

        const skip = (pagina - 1) * limite;
        const sortOrder = orden === 'desc' ? -1 : 1;

        const clientes = await Client.find(filtro)
            .select('-__v')
            .sort({ [orderBy]: sortOrder })
            .skip(skip)
            .limit(limite)
            .populate('historialPedidos', 'total estadoPago fechaCreacion');

        const total = await Client.countDocuments(filtro);

        res.json({
            ok: true,
            clientes,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (err) {
        console.error('❌ Error obteniendo clientes:', err.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
};

/**
 * Obtener un cliente por ID
 */
export const getClientById = async (req, res) => {
    try {
        const cliente = await Client.findById(req.params.id)
            .populate('historialPedidos');

        if (!cliente || !cliente.activo) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ ok: true, cliente });

    } catch (err) {
        console.error('❌ Error obteniendo cliente:', err.message);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
};

/**
 * Actualizar cliente (admin)
 */
export const updateClient = async (req, res) => {
    try {
        const { error, value } = clientSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const cliente = await Client.findById(req.params.id);
        if (!cliente || !cliente.activo) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Verificar si email ya existe (y no es el mismo cliente)
        if (value.email !== cliente.email) {
            const emailExists = await Client.findOne({ 
                email: value.email, 
                _id: { $ne: req.params.id } 
            });
            if (emailExists) {
                return res.status(400).json({ error: 'Email ya está registrado' });
            }
        }

        // Actualizar campos
        cliente.nombre = value.nombre;
        cliente.email = value.email;
        cliente.whatsapp = value.whatsapp;
        cliente.notasInternas = value.notasInternas;
        
        // Actualizar campos de dirección si vienen en el body
        if (value.domicilio !== undefined) cliente.domicilio = value.domicilio;
        if (value.localidad !== undefined) cliente.localidad = value.localidad;
        if (value.provincia !== undefined) cliente.provincia = value.provincia;
        if (value.codigoPostal !== undefined) cliente.codigoPostal = value.codigoPostal;
        // Legacy fields
        if (value.direccion !== undefined) cliente.direccion = value.direccion;
        if (value.ciudad !== undefined) cliente.ciudad = value.ciudad;

        await cliente.save();

        console.log(`✅ Cliente ${req.params.id} actualizado`);

        res.json({
            ok: true,
            mensaje: 'Cliente actualizado',
            cliente
        });

    } catch (err) {
        console.error('❌ Error actualizando cliente:', err.message);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
};

/**
 * Eliminar cliente (soft delete)
 */
export const deleteClient = async (req, res) => {
    try {
        const cliente = await Client.findById(req.params.id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        cliente.activo = false;
        await cliente.save();

        console.log(`✅ Cliente ${req.params.id} desactivado`);

        res.json({
            ok: true,
            mensaje: 'Cliente desactivado'
        });

    } catch (err) {
        console.error('❌ Error eliminando cliente:', err.message);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
};

/**
 * Obtener historial de pedidos de un cliente
 */
export const getClientHistory = async (req, res) => {
    try {
        const cliente = await Client.findById(req.params.id);
        if (!cliente || !cliente.activo) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const ordenes = await Order.find({ clienteId: req.params.id })
            .populate('items.productoId', 'nombre')
            .sort({ fechaCreacion: -1 });

        // Estadísticas
        const totalPedidos = ordenes.length;
        const totalGastado = ordenes.reduce((sum, o) => sum + o.total, 0);
        const pedidosEntregados = ordenes.filter(o => o.estadoPedido === 'entregado').length;

        res.json({
            ok: true,
            cliente: {
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp
            },
            estadisticas: {
                totalPedidos,
                totalGastado,
                pedidosEntregados,
                pedidosPendientes: totalPedidos - pedidosEntregados
            },
            ordenes
        });

    } catch (err) {
        console.error('❌ Error obteniendo historial:', err.message);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
};

/**
 * Obtener estadísticas generales de clientes (admin dashboard)
 */
export const getClientStats = async (req, res) => {
    try {
        const totalClientes = await Client.countDocuments({ activo: true });
        
        const clientesConPedidos = await Client.find({ activo: true })
            .select('totalGastado totalPedidos');

        const totalGastado = clientesConPedidos.reduce((sum, c) => sum + c.totalGastado, 0);
        const totalPedidos = clientesConPedidos.reduce((sum, c) => sum + c.totalPedidos, 0);

        const promedio = totalClientes > 0 ? totalGastado / totalClientes : 0;

        // Últimos clientes
        const ultimosClientes = await Client.find({ activo: true })
            .sort({ fechaCreacion: -1 })
            .limit(5);

        res.json({
            ok: true,
            estadisticas: {
                totalClientes,
                totalGastado,
                totalPedidos,
                gastosPromedio: parseFloat(promedio.toFixed(2))
            },
            ultimosClientes
        });

    } catch (err) {
        console.error('❌ Error obteniendo estadísticas:', err.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

export default {
    getClients,
    getClientById,
    updateClient,
    deleteClient,
    getClientHistory,
    getClientStats
};
