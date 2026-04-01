/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Lógica de negocio para consultas y reportes de pedidos.
 * Los controladores llaman a estas funciones en lugar de
 * hablar directamente con la base de datos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cada método recibe parámetros simples (IDs, filtros).
 * 2. Aplica .lean() en lecturas para mayor velocidad.
 * 3. Devuelve los datos listos para que el controlador
 *    los envíe al cliente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los pedidos no aparecen en el panel? → Revisa getOrdersFiltered()
 *   y los filtros de estadoPago.
 * - ¿El dashboard no muestra estadísticas? → Revisa getSalesReport()
 *   y getAllOrdersNoPagination().
 * ======================================================
 */

import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';

export class OrderService {

    // ======== PEDIDOS DE UN CLIENTE ========
    // Devuelve la lista de pedidos de un cliente, del más reciente al más antiguo.
    static async getOrdersByClient(clientId, limit = 20, skip = 0) {
        return Order
            .find({ clienteId: clientId })
            .lean()
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    // ======== OBTENER UN PEDIDO POR ID ========
    // Trae el pedido completo con nombre e email del cliente y los productos.
    // No usa .lean() porque el resultado puede necesitar guardarse.
    static async getOrderById(orderId) {
        return Order.findById(orderId)
            .populate('clienteId', 'nombre email whatsapp')
            .populate('items.productoId', 'nombre precio');
    }

    // ======== OBTENER MÚLTIPLES PRODUCTOS ========
    // Una sola consulta a la base de datos en lugar de una por cada producto.
    static async getProductsByIds(productIds) {
        return Producto
            .find({ _id: { $in: productIds } })
            .lean()
            .select('_id nombre precio stock cantidadUnidades');
    }

    // ======== ESTADÍSTICAS DE UN CLIENTE ========
    // Total de pedidos, monto acumulado y promedio de compra.
    static async getClientStats(clientId) {
        const stats = await Order.aggregate([
            { $match: { clienteId: clientId } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$total' },
                    averageOrder: { $avg: '$total' }
                }
            }
        ]);

        return stats[0] || { totalOrders: 0, totalSpent: 0, averageOrder: 0 };
    }

    // ======== PEDIDOS CON FILTROS (PARA EL PANEL ADMIN) ========
    // Permite filtrar por estado de pago, estado del pedido y rango de fechas.
    static async getOrdersFiltered(filters = {}, limit = 50, skip = 0) {
        const {
            clienteId,
            estadoPago,
            estadoPedido,
            fechaDesde,
            fechaHasta
        } = filters;

        const query = {};

        if (clienteId) query.clienteId = clienteId;
        if (estadoPago) query.estadoPago = estadoPago;
        if (estadoPedido) query.estadoPedido = estadoPedido;

        if (fechaDesde || fechaHasta) {
            query.createdAt = {};
            if (fechaDesde) query.createdAt.$gte = new Date(fechaDesde);
            if (fechaHasta) query.createdAt.$lte = new Date(fechaHasta);
        }

        return Order
            .find(query)
            .lean()
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    // ======== REPORTE DE VENTAS POR FECHA ========
    // Agrupa los pedidos aprobados por día y suma el total vendido.
    static async getSalesReport(fechaDesde, fechaHasta) {
        return Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(fechaDesde),
                        $lte: new Date(fechaHasta)
                    },
                    // Solo órdenes con pago confirmado — no incluir pendientes ni rechazadas
                    estadoPago: 'approved'
                }
            },
            {
                $group: {
                    _id: {
                        año: { $year: '$createdAt' },
                        mes: { $month: '$createdAt' },
                        dia: { $dayOfMonth: '$createdAt' }
                    },
                    totalVentas: { $sum: '$total' },
                    cantidadOrdenes: { $sum: 1 },
                    cantidadProductos: { $sum: '$cantidadProductos' }
                }
            },
            { $sort: { '_id.año': 1, '_id.mes': 1, '_id.dia': 1 } }
        ]);
    }

    // ======== VERIFICAR QUE UN PEDIDO PERTENECE A UN CLIENTE ========
    // Devuelve true si la orden le pertenece al cliente indicado.
    // Impide que un cliente vea pedidos ajenos.
    static async validateOrderOwnership(orderId, clientId) {
        const order = await Order.findById(orderId).select('clienteId').lean();
        return order && order.clienteId.toString() === clientId.toString();
    }

    // ======== TODOS LOS PEDIDOS SIN PÁGINACIÓN ========
    // Devuelve todos los pedidos que coinciden con los filtros,
    // sin límite de registros. Usado por el dashboard de estadísticas.
    // Por defecto excluye pedidos con pago pendiente.
    static async getAllOrdersNoPagination(filters = {}) {
        const { estadoPago, estadoPedido, fechaDesde, fechaHasta } = filters;

        const filter = {};

        // Por defecto se excluyen pedidos con pago aún pendiente
        if (estadoPago && ['pending', 'approved', 'refunded', 'cancelled'].includes(estadoPago)) {
            filter.estadoPago = estadoPago;
        } else if (!estadoPago) {
            filter.estadoPago = { $ne: 'pending' };
        }

        if (estadoPedido && ['en_produccion', 'enviado', 'entregado'].includes(estadoPedido)) {
            filter.estadoPedido = estadoPedido;
        }

        if (fechaDesde || fechaHasta) {
            filter.createdAt = {};
            if (fechaDesde) {
                try {
                    filter.createdAt.$gte = new Date(fechaDesde);
                } catch (e) {
                    throw new Error('fechaDesde inválida');
                }
            }
            if (fechaHasta) {
                try {
                    filter.createdAt.$lte = new Date(fechaHasta);
                } catch (e) {
                    throw new Error('fechaHasta inválida');
                }
            }
        }

        const ordenes = await Order.find(filter)
            .lean()
            .sort({ createdAt: -1 });

        return ordenes;
    }
}

export default OrderService;
