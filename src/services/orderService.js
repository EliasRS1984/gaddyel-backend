/**
 * Service: Order Management
 * Descripción: Lógica de negocio para manejo de órdenes
 * Propósito: Crear órdenes, validar, procesar pagos, actualizar estado
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const MercadoPagoService = require('./mercadopagoService');
const { logAudit } = require('../utils/logger');

class OrderService {
  /**
   * Crear nueva orden desde carrito
   * @param {Object} orderData - Datos de la orden
   * @returns {Object} - Orden creada con preferencia de pago
   */
  static async createOrder(orderData) {
    try {
      const {
        customerData,
        items,
        shippingAddress,
        shippingCost = 0,
        discount = 0,
        idempotencyKey,
        ipAddress,
        userAgent,
      } = orderData;

      logAudit('CREATE_ORDER_START', { customerEmail: customerData.email, itemCount: items.length }, 'INFO');

      // 1. Validar que existen los productos y tienen stock
      await this.validateOrderItems(items);

      // 2. Obtener o crear cliente
      const customer = await Customer.findOrCreateByEmail({
        ...customerData,
        addresses: shippingAddress ? [shippingAddress] : [],
      });

      // 3. Calcular totales
      const orderCalculation = this.calculateOrderTotals(items, shippingCost, discount);

      // 4. Crear orden en BD
      const order = await Order.create({
        orderNumber: await Order.getNextOrderNumber(),
        customer: customer._id,
        customerSnapshot: {
          name: customer.name,
          email: customer.email,
          whatsapp: customer.whatsapp,
          cuit: customer.cuit,
          address: shippingAddress,
        },
        items: items.map(item => ({
          product: item.productId,
          productName: item.productName,
          productSnapshot: {
            sku: item.sku,
            price: item.price,
            discount: item.discount || 0,
          },
          quantity: item.quantity,
          price: item.price,
          variations: item.variations || {},
        })),
        subtotal: orderCalculation.subtotal,
        shippingCost: shippingCost,
        discount: discount,
        total: orderCalculation.total,
        status: 'pending_payment',
        shippingAddress: shippingAddress,
        idempotencyKey: idempotencyKey,
        createdFromIP: ipAddress,
        createdFromUserAgent: userAgent,
        metadata: {
          source: 'web',
          paymentMethod: 'mercadopago',
        },
      });

      logAudit('ORDER_CREATED', { orderId: order._id, orderNumber: order.orderNumber }, 'INFO');

      // 5. Reservar stock de los productos
      await this.reserveStock(items);

      logAudit('STOCK_RESERVED', { orderId: order._id, itemCount: items.length }, 'INFO');

      // 6. Crear preferencia de pago en Mercado Pago
      const preferenceData = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        items: items,
        customer: {
          name: customer.name,
          email: customer.email,
          whatsapp: customer.whatsapp,
          _id: customer._id,
        },
        notificationUrl: `${process.env.API_URL}/api/webhooks/mercadopago`,
      };

      let preference;
      try {
        preference = await MercadoPagoService.createPreference(preferenceData);
      } catch (error) {
        // Si falla Mercado Pago, liberar stock y cancelar orden
        await this.releaseStock(items);
        order.status = 'failed';
        await order.save();
        
        logAudit('PREFERENCE_CREATION_FAILED', { orderId: order._id, error: error.message }, 'ERROR');
        throw new Error(`No se pudo crear preferencia de pago: ${error.message}`);
      }

      // 7. Actualizar orden con datos de Mercado Pago
      order.mercadopagoPreferenceId = preference.preferenceId;
      order.checkoutUrl = preference.checkoutUrl;
      order.sandboxCheckoutUrl = preference.sandboxCheckoutUrl;
      await order.save();

      logAudit('ORDER_READY_FOR_CHECKOUT', { orderId: order._id, preferenceId: preference.preferenceId }, 'INFO');

      return {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
        },
        checkout: {
          preferenceId: preference.preferenceId,
          checkoutUrl: preference.checkoutUrl,
          sandboxCheckoutUrl: preference.sandboxCheckoutUrl,
        },
      };
    } catch (error) {
      logAudit('CREATE_ORDER_ERROR', { error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Procesar pago exitoso desde webhook
   * @param {String} orderId - ID de la orden
   * @param {Object} paymentData - Datos del pago
   * @returns {Object} - Orden actualizada
   */
  static async processPaymentSuccess(orderId, paymentData) {
    try {
      const { paymentId, status, amount } = paymentData;

      logAudit('PROCESS_PAYMENT_SUCCESS', { orderId, paymentId, amount }, 'INFO');

      // Obtener orden
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      // Validar monto
      if (Math.abs(amount - order.total) > 0.01) {
        logAudit('PAYMENT_AMOUNT_MISMATCH', { orderId, expectedAmount: order.total, receivedAmount: amount }, 'ERROR');
        throw new Error('El monto del pago no coincide con la orden');
      }

      // Registrar intento de pago
      order.recordPaymentAttempt({
        paymentId: paymentId,
        status: status,
        amount: amount,
        method: 'mercadopago',
        processor: 'mercadopago',
        timestamp: new Date(),
        metadata: {
          source: 'webhook',
        },
      });

      // Actualizar estado de la orden
      order.status = 'paid';
      order.paidAt = new Date();
      await order.save();

      // Confirmar venta en productos (disminuir total, resetear reserved)
      await this.confirmSales(order.items);

      // Registrar orden en cliente
      await Customer.findByIdAndUpdate(order.customer, {
        $push: { orderHistory: order._id },
      });

      logAudit('PAYMENT_SUCCESS_PROCESSED', { orderId, paymentId }, 'INFO');

      return order;
    } catch (error) {
      logAudit('PROCESS_PAYMENT_SUCCESS_ERROR', { orderId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Procesar pago rechazado
   * @param {String} orderId - ID de la orden
   * @param {Object} paymentData - Datos del pago
   * @returns {Object} - Orden actualizada
   */
  static async processPaymentRejected(orderId, paymentData) {
    try {
      const { paymentId, statusDetail } = paymentData;

      logAudit('PROCESS_PAYMENT_REJECTED', { orderId, paymentId, reason: statusDetail }, 'WARNING');

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      // Registrar intento fallido
      order.markPaymentFailed(statusDetail, paymentId);
      await order.save();

      logAudit('PAYMENT_REJECTION_RECORDED', { orderId, paymentId }, 'INFO');

      return {
        orderId: order._id,
        status: order.status,
        canRetry: order.allowRetry(),
        message: `Pago rechazado: ${statusDetail}`,
      };
    } catch (error) {
      logAudit('PROCESS_PAYMENT_REJECTED_ERROR', { orderId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Procesar pago pendiente
   * @param {String} orderId - ID de la orden
   * @param {Object} paymentData - Datos del pago
   * @returns {Object} - Orden actualizada
   */
  static async processPaymentPending(orderId, paymentData) {
    try {
      const { paymentId, statusDetail } = paymentData;

      logAudit('PROCESS_PAYMENT_PENDING', { orderId, paymentId, statusDetail }, 'INFO');

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      // Registrar intento
      order.recordPaymentAttempt({
        paymentId: paymentId,
        status: 'pending',
        method: 'mercadopago',
        processor: 'mercadopago',
        timestamp: new Date(),
        statusDetail: statusDetail,
      });

      order.status = 'pending_payment';
      await order.save();

      logAudit('PAYMENT_PENDING_RECORDED', { orderId, paymentId }, 'INFO');

      return order;
    } catch (error) {
      logAudit('PROCESS_PAYMENT_PENDING_ERROR', { orderId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Reintentar pago de una orden
   * @param {String} orderId - ID de la orden
   * @returns {Object} - Orden actualizada con nueva preferencia
   */
  static async retryPayment(orderId) {
    try {
      logAudit('RETRY_PAYMENT_START', { orderId }, 'INFO');

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      // Verificar si puede reintentar
      if (!order.allowRetry()) {
        throw new Error('No se puede reintentar el pago para esta orden');
      }

      // Resetear orden a pending_payment
      order.status = 'pending_payment';
      await order.save();

      // Crear nueva preferencia
      const customer = await Customer.findById(order.customer);
      const preferenceData = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        items: order.items.map(item => ({
          productId: item.product,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          sku: item.productSnapshot?.sku,
        })),
        customer: {
          name: customer.name,
          email: customer.email,
          whatsapp: customer.whatsapp,
          _id: customer._id,
        },
        notificationUrl: `${process.env.API_URL}/api/webhooks/mercadopago`,
      };

      const preference = await MercadoPagoService.createPreference(preferenceData);

      order.mercadopagoPreferenceId = preference.preferenceId;
      order.checkoutUrl = preference.checkoutUrl;
      await order.save();

      logAudit('RETRY_PAYMENT_SUCCESS', { orderId, newPreferenceId: preference.preferenceId }, 'INFO');

      return {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
        },
        checkout: {
          preferenceId: preference.preferenceId,
          checkoutUrl: preference.checkoutUrl,
        },
      };
    } catch (error) {
      logAudit('RETRY_PAYMENT_ERROR', { orderId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * Obtener detalles de una orden
   * @param {String} orderId - ID de la orden
   * @returns {Object} - Datos de la orden
   */
  static async getOrderDetails(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate('customer', 'name email whatsapp')
        .populate('items.product', 'name sku price');

      if (!order) {
        throw new Error('Orden no encontrada');
      }

      return order;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Procesar reembolso de una orden
   * @param {String} orderId - ID de la orden
   * @param {String} reason - Razón del reembolso
   * @returns {Object} - Resultado del reembolso
   */
  static async refundOrder(orderId, reason = 'Customer request') {
    try {
      logAudit('REFUND_ORDER_START', { orderId, reason }, 'INFO');

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      if (!order.paymentHistory || order.paymentHistory.length === 0) {
        throw new Error('No hay registros de pago para esta orden');
      }

      // Obtener el último pago aprobado
      const lastApprovedPayment = order.paymentHistory.find(p => p.status === 'approved');
      if (!lastApprovedPayment) {
        throw new Error('No hay pagos aprobados para reembolsar');
      }

      // Procesar reembolso en Mercado Pago
      const refund = await MercadoPagoService.refundPayment(lastApprovedPayment.paymentId);

      // Registrar reembolso en orden
      order.refund(order.total, reason);
      order.status = 'refunded';
      await order.save();

      // Liberar stock
      await this.releaseStock(order.items);

      logAudit('REFUND_ORDER_SUCCESS', { orderId, refundId: refund.refundId }, 'INFO');

      return {
        orderId: order._id,
        refundId: refund.refundId,
        amount: refund.amount,
        status: refund.status,
      };
    } catch (error) {
      logAudit('REFUND_ORDER_ERROR', { orderId, error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * ========== MÉTODOS PRIVADOS / HELPERS ==========
   */

  /**
   * Validar que los items existan y tengan stock
   */
  static async validateOrderItems(items) {
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        throw new Error(`Producto ${item.productId} no encontrado`);
      }

      if (!product.isAvailable()) {
        throw new Error(`Producto ${product.name} no está disponible`);
      }

      if (product.stock.available < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}`);
      }
    }
  }

  /**
   * Calcular totales de la orden
   */
  static calculateOrderTotals(items, shippingCost = 0, discount = 0) {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const total = subtotal + shippingCost - discount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Reservar stock para los items
   */
  static async reserveStock(items) {
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.reserveStock(item.quantity);
        await product.save();
      }
    }
  }

  /**
   * Liberar stock reservado
   */
  static async releaseStock(items) {
    for (const item of items) {
      const product = await Product.findById(item.product || item.productId);
      if (product) {
        product.releaseStock(item.quantity || 1);
        await product.save();
      }
    }
  }

  /**
   * Confirmar venta (disminuir total, resetear reserved)
   */
  static async confirmSales(items) {
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.confirmSale(item.quantity);
        await product.save();
      }
    }
  }
}

module.exports = OrderService;
