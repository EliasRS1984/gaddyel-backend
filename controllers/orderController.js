const Order = require('../models/Order');
const Product = require('../models/Product');
const OrderEventLog = require('../models/OrderEventLog');
const mercadoPagoService = require('../services/MercadoPagoService');

// Crear orden
exports.createOrder = async (req, res) => {
  try {
    const { items, customer, shipping } = req.body;

    // Validaciones
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    if (!customer || !customer.fullName || !customer.email || !customer.whatsapp) {
      return res.status(400).json({ error: 'Customer information is incomplete' });
    }

    // Validar stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}` 
        });
      }
    }

    // Calcular totales
    let subtotal = 0;
    let taxes = 0;
    const shippingCost = shipping?.shippingCost || 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      const itemSubtotal = item.quantity * product.price;
      subtotal += itemSubtotal;
    }

    // Calcular impuestos (21% IVA en Argentina)
    taxes = subtotal * 0.21;
    const total = subtotal + taxes + shippingCost;

    // Crear orden
    const order = new Order({
      items: items.map(item => ({
        ...item,
        subtotal: item.quantity * item.unitPrice
      })),
      customer,
      shipping,
      totals: {
        subtotal,
        taxes,
        shippingCost,
        total
      },
      payment: {
        transaction_amount: total
      },
      orderStatus: 'pending_payment',
      metadata: {
        createdAt: new Date()
      }
    });

    await order.save();

    // Crear preferencia en Mercado Pago
    const preference = await mercadoPagoService.createPreference(order);

    // Actualizar orden con preference ID
    order.payment.mp_preference_id = preference.preferenceId;
    await order.save();

    // Log del evento
    await mercadoPagoService.logOrderEvent(
      order._id,
      null,
      'pending_payment',
      'pending',
      null,
      'ORDER_CREATED',
      { preferenceId: preference.preferenceId },
      'SYSTEM'
    );

    return res.status(201).json({
      orderId: order._id,
      checkoutUrl: preference.checkoutUrl,
      sandboxUrl: preference.sandboxUrl,
      total: total,
      orderStatus: order.orderStatus
    });
  } catch (error) {
    console.error('Error creating order:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Obtener orden
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('items.productId', 'name price')
      .populate('customerId', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // No exponer datos sensibles
    const safeOrder = {
      _id: order._id,
      items: order.items,
      customer: {
        fullName: order.customer.fullName,
        email: order.customer.email,
        whatsapp: order.customer.whatsapp
      },
      shipping: order.shipping,
      totals: order.totals,
      orderStatus: order.orderStatus,
      metadata: {
        createdAt: order.metadata.createdAt,
        updatedAt: order.metadata.updatedAt
      },
      payment: {
        mp_status: order.payment.mp_status,
        mp_status_detail: order.payment.mp_status_detail,
        payment_method_id: order.payment.payment_method_id,
        isFromMercadoCredito: order.payment.isFromMercadoCredito
      }
    };

    return res.status(200).json(safeOrder);
  } catch (error) {
    console.error('Error fetching order:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Listar órdenes (admin)
exports.listOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, fromMercadoCredito } = req.query;

    const query = {};

    if (status) {
      query.orderStatus = status;
    }

    if (fromMercadoCredito === 'true') {
      query['payment.isFromMercadoCredito'] = true;
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ 'metadata.createdAt': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    return res.status(200).json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing orders:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Reintentar pago
exports.retryPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Generar nueva preferencia
    const preference = await mercadoPagoService.retryPayment(id);

    return res.status(200).json({
      checkoutUrl: preference.checkoutUrl,
      sandboxUrl: preference.sandboxUrl,
      retryCount: order.metadata.retryCount
    });
  } catch (error) {
    console.error('Error retrying payment:', error.message);
    return res.status(400).json({ error: error.message });
  }
};

// Cambiar estado de orden (admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, adminNotes } = req.body;

    const validStatuses = [
      'pending_payment',
      'waiting_confirmation',
      'paid',
      'rejected',
      'cancelled',
      'frozen',
      'preparing',
      'shipped',
      'delivered',
      'failed_payment_permanent'
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = order.orderStatus;

    // Actualizar estado
    order.orderStatus = newStatus;
    if (adminNotes) {
      order.metadata.adminNotes = adminNotes;
    }
    order.metadata.updatedAt = new Date();

    await order.save();

    // Log del evento
    await mercadoPagoService.logOrderEvent(
      order._id,
      oldStatus,
      newStatus,
      null,
      null,
      'MANUAL_STATUS_CHANGE',
      { adminNotes },
      'ADMIN'
    );

    return res.status(200).json({
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Obtener auditoría de orden
exports.getOrderAudit = async (req, res) => {
  try {
    const { id } = req.params;

    const logs = await OrderEventLog.find({ orderId: id })
      .sort({ timestamp: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching audit:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Dashboard stats (admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total de ventas
    const totalSales = await Order.countDocuments({
      orderStatus: 'paid'
    });

    // Ventas del mes
    const monthlySales = await Order.countDocuments({
      orderStatus: 'paid',
      'metadata.createdAt': { $gte: startOfMonth }
    });

    // Recaudación total
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totals.total' } } }
    ]);

    // Recaudación del mes
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          orderStatus: 'paid',
          'metadata.createdAt': { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$totals.total' } } }
    ]);

    // Pagos pendientes
    const pendingPayments = await Order.countDocuments({
      orderStatus: { $in: ['pending_payment', 'in_process', 'waiting_confirmation'] }
    });

    // Pagos fallidos
    const failedPayments = await Order.countDocuments({
      orderStatus: { $in: ['rejected', 'failed_payment_permanent'] }
    });

    // Órdenes con Mercado Crédito
    const mercadoCreditoOrders = await Order.countDocuments({
      'payment.isFromMercadoCredito': true,
      orderStatus: 'paid'
    });

    // Recaudación Mercado Crédito
    const mercadoCreditoRevenue = await Order.aggregate([
      {
        $match: {
          'payment.isFromMercadoCredito': true,
          orderStatus: 'paid'
        }
      },
      { $group: { _id: null, total: { $sum: '$totals.total' } } }
    ]);

    return res.status(200).json({
      totalSales,
      monthlySales,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      pendingPayments,
      failedPayments,
      mercadoCreditoOrders,
      mercadoCreditoRevenue: mercadoCreditoRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
