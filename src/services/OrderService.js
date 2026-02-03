/**
 * OrderService - Capa de servicios para lógica de órdenes
 * ✅ Separa responsabilidades: Controllers vs Business Logic
 * ✅ Usa .lean() para mejor performance en lecturas
 */

import Order from '../models/Order.js';
import Client from '../models/Client.js';
import { Producto } from '../models/Product.js';

export class OrderService {
    /**
     * ✅ Obtiene órdenes de un cliente con .lean()
     * Performance: 50%+ más rápido que sin .lean()
     */
    static async getOrdersByClient(clientId, limit = 20, skip = 0) {
        return Order
            .find({ clienteId: clientId })
            .lean() // ✅ Solo devuelve objetos planos
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    /**
     * ✅ Obtiene una orden específica (sin .lean si se va a modificar)
     */
    static async getOrderById(orderId) {
        return Order.findById(orderId)
            .populate('clienteId', 'nombre email whatsapp')
            .populate('items.productoId', 'nombre precio');
    }

    /**
     * ✅ Obtiene múltiples productos eficientemente
     * Una sola query en lugar de N queries
     */
    static async getProductsByIds(productIds) {
        return Producto
            .find({ _id: { $in: productIds } })
            .lean() // ✅ Performance critical
            .select('_id nombre precio stock cantidadUnidades');
    }

    /**
     * ✅ Obtiene estadísticas de cliente usando aggregation
     */
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

    /**
     * ✅ Obtiene órdenes con filtros avanzados (para admin)
     */
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

        // Filtrar por rango de fechas
        if (fechaDesde || fechaHasta) {
            query.createdAt = {};
            if (fechaDesde) query.createdAt.$gte = new Date(fechaDesde);
            if (fechaHasta) query.createdAt.$lte = new Date(fechaHasta);
        }

        return Order
            .find(query)
            .lean() // ✅ Para reportes/lecturas
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    /**
     * ✅ Obtiene resumen de ventas por período (para dashboard admin)
     */
    static async getSalesReport(fechaDesde, fechaHasta) {
        return Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(fechaDesde),
                        $lte: new Date(fechaHasta)
                    }
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

    /**
     * ✅ Valida que una orden pertenezca a un cliente
     * Previene acceso no autorizado
     */
    static async validateOrderOwnership(orderId, clientId) {
        const order = await Order.findById(orderId).select('clienteId').lean();
        return order && order.clienteId.toString() === clientId.toString();
    }

    /**
     * ✅ NUEVO: Obtiene TODAS las órdenes sin paginación
     * Usado por Dashboard para estadísticas
     * @param {Object} filters - Filtros opcionales (estadoPago, estadoPedido, etc)
     * @returns {Promise<Array>} TODAS las órdenes que coincidan con filtros
     */
    static async getAllOrdersNoPagination(filters = {}) {
        const { estadoPago, estadoPedido, fechaDesde, fechaHasta } = filters;

        // ✅ Construir filtro dinámico con validación
        const filter = {};

        // 🔒 FILTRO CRÍTICO: Por defecto, EXCLUIR órdenes "pending"
        // Igual que en getOrders() del controller
        if (estadoPago && ['pending', 'approved', 'refunded', 'cancelled'].includes(estadoPago)) {
            filter.estadoPago = estadoPago;
        } else if (!estadoPago) {
            // Por defecto: Solo órdenes con pago CONFIRMADO
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

        // ✅ Sin paginación - devuelve TODAS
        const ordenes = await Order.find(filter)
            .lean()
            .sort({ createdAt: -1 });

        return ordenes;
    }
}

export default OrderService;
