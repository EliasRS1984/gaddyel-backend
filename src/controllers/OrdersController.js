/**
 * Controller: Orders
 * Descripción: Manejo de órdenes de compra
 * Propósito: Crear, listar, obtener detalles de órdenes
 */

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const OrderService = require('../services/orderService');
const { logAudit } = require('../utils/logger');

class OrdersController {
  /**
   * POST /api/orders
   * Crear nueva orden
   */
  static async createOrder(req, res) {
    try {
      const { customerData, items, shippingAddress, shippingCost, discount } = req.body;

      // Datos de auditoría
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      logAudit('CREATE_ORDER_REQUEST', {
        customerEmail: customerData?.email,
        itemCount: items?.length,
        total: items?.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      }, 'INFO');

      // Crear orden
      const result = await OrderService.createOrder({
        customerData,
        items,
        shippingAddress,
        shippingCost: shippingCost || 0,
        discount: discount || 0,
        idempotencyKey: req.body.idempotencyKey || crypto.randomUUID(),
        ipAddress,
        userAgent,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Orden creada exitosamente',
      });
    } catch (error) {
      logAudit('CREATE_ORDER_ERROR', { error: error.message }, 'ERROR');

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/orders
   * Listar órdenes (con filtros y paginación)
   */
  static async listOrders(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        customerId,
        customerEmail,
        startDate,
        endDate,
        minTotal,
        maxTotal,
      } = req.query;

      // Construir filtro
      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (customerId) {
        filter.customer = customerId;
      }

      if (customerEmail) {
        // Buscar cliente por email
        const customer = await Customer.findOne({ email: customerEmail });
        if (customer) {
          filter.customer = customer._id;
        }
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }

      if (minTotal || maxTotal) {
        filter.total = {};
        if (minTotal) {
          filter.total.$gte = parseFloat(minTotal);
        }
        if (maxTotal) {
          filter.total.$lte = parseFloat(maxTotal);
        }
      }

      // Calcular paginación
      const skip = (page - 1) * limit;

      // Obtener órdenes
      const orders = await Order.find(filter)
        .populate('customer', 'name email whatsapp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Contar total
      const total = await Order.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logAudit('LIST_ORDERS_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error listando órdenes',
      });
    }
  }

  /**
   * GET /api/orders/:orderId
   * Obtener detalles de una orden
   */
  static async getOrderById(req, res) {
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId)
        .populate('customer', 'name email whatsapp cuit address')
        .populate('items.product', 'name sku price category');

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo orden',
      });
    }
  }

  /**
   * GET /api/orders/number/:orderNumber
   * Obtener orden por número de orden
   */
  static async getOrderByNumber(req, res) {
    try {
      const { orderNumber } = req.params;

      const order = await Order.findOne({ orderNumber: parseInt(orderNumber) })
        .populate('customer', 'name email whatsapp')
        .populate('items.product', 'name sku price');

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo orden',
      });
    }
  }

  /**
   * GET /api/customer/:customerId/orders
   * Obtener órdenes de un cliente
   */
  static async getCustomerOrders(req, res) {
    try {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validar que el cliente existe
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Cliente no encontrado',
        });
      }

      // Calcular paginación
      const skip = (page - 1) * limit;

      // Obtener órdenes
      const orders = await Order.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('orderNumber status total createdAt paidAt items');

      // Contar total
      const total = await Order.countDocuments({ customer: customerId });

      res.status(200).json({
        success: true,
        data: {
          customer: {
            _id: customer._id,
            name: customer.name,
            email: customer.email,
          },
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logAudit('GET_CUSTOMER_ORDERS_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error obteniendo órdenes del cliente',
      });
    }
  }

  /**
   * PUT /api/orders/:orderId/status
   * Actualizar estado de una orden (solo admin)
   */
  static async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;

      // Estados permitidos
      const validStatuses = [
        'pending_payment',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'failed',
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Estado inválido. Estados permitidos: ${validStatuses.join(', ')}`,
        });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Orden no encontrada',
        });
      }

      // Actualizar estado
      order.status = status;
      if (notes) {
        order.metadata = order.metadata || {};
        order.metadata.adminNotes = notes;
      }

      await order.save();

      logAudit('ORDER_STATUS_UPDATED', {
        orderId,
        orderNumber: order.orderNumber,
        newStatus: status,
      }, 'INFO');

      res.status(200).json({
        success: true,
        data: order,
        message: `Orden actualizada a estado "${status}"`,
      });
    } catch (error) {
      logAudit('UPDATE_ORDER_STATUS_ERROR', { orderId: req.params.orderId, error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error actualizando orden',
      });
    }
  }

  /**
   * GET /api/orders/analytics/dashboard
   * Dashboard de estadísticas de órdenes (solo admin)
   */
  static async getOrderAnalytics(req, res) {
    try {
      // Total de órdenes
      const totalOrders = await Order.countDocuments();

      // Órdenes por estado
      const ordersByStatus = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$total' },
          },
        },
      ]);

      // Ingresos totales
      const totalRevenue = await Order.aggregate([
        {
          $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
          },
        },
      ]);

      // Órdenes del último mes
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const lastMonthOrders = await Order.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      // Promedio de orden
      const averageOrderValue = totalOrders > 0
        ? (totalRevenue[0]?.revenue || 0) / totalOrders
        : 0;

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalOrders,
            totalRevenue: totalRevenue[0]?.revenue || 0,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            lastMonthOrders,
          },
          ordersByStatus: ordersByStatus.reduce((acc, item) => {
            acc[item._id] = {
              count: item.count,
              total: item.total,
            };
            return acc;
          }, {}),
        },
      });
    } catch (error) {
      logAudit('GET_ORDER_ANALYTICS_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error obteniendo analytics',
      });
    }
  }
}

module.exports = OrdersController;
