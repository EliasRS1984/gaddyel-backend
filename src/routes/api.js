/**
 * Routes: API Principal
 * Descripción: Definición de todas las rutas de la API
 * Propósito: Conectar controllers con endpoints HTTP
 */

const express = require('express');
const router = express.Router();

// Controllers
const ProductsController = require('../controllers/ProductsController');
const OrdersController = require('../controllers/OrdersController');
const PaymentsController = require('../controllers/PaymentsController');

// Validations & Middlewares
const { validate, validateQuery, validateParams, schemas } = require('../validations/schemas');
const { strictLimiter, webhookLimiter } = require('../middlewares/security');

/**
 * =========== PRODUCTOS ===========
 */

// GET /api/products - Listar productos con filtros
router.get('/products', validateQuery(schemas.listProducts), ProductsController.listProducts);

// GET /api/products/featured - Productos destacados
router.get('/products/featured', ProductsController.getFeaturedProducts);

// GET /api/products/new-arrivals - Nuevos llegados
router.get('/products/new-arrivals', ProductsController.getNewArrivals);

// GET /api/products/search - Buscar productos
router.get('/products/search', validateQuery(schemas.searchProducts), ProductsController.searchProducts);

// GET /api/products/category/:category - Productos por categoría
router.get('/products/category/:category', ProductsController.getProductsByCategory);

// GET /api/products/analytics/popular - Productos más vendidos
router.get('/products/analytics/popular', ProductsController.getPopularProducts);

// GET /api/products/analytics/low-stock - Bajo stock (admin)
router.get('/products/analytics/low-stock', ProductsController.getLowStockProducts);

// GET /api/products/availability/:productId - Verificar disponibilidad
router.get('/products/availability/:productId', validateQuery(schemas.checkAvailability), ProductsController.checkProductAvailability);

// GET /api/products/:slug - Obtener por slug
router.get('/products/:slug', ProductsController.getProductBySlug);

// GET /api/products/id/:productId - Obtener por ID
router.get('/products/id/:productId', ProductsController.getProductById);

/**
 * =========== ÓRDENES ===========
 */

// POST /api/orders - Crear nueva orden
router.post(
  '/orders',
  strictLimiter,
  validate(schemas.createOrder),
  OrdersController.createOrder
);

// GET /api/orders - Listar órdenes con filtros
router.get('/orders', validateQuery(schemas.listOrders), OrdersController.listOrders);

// GET /api/orders/analytics/dashboard - Dashboard de estadísticas
router.get('/orders/analytics/dashboard', OrdersController.getOrderAnalytics);

// GET /api/orders/number/:orderNumber - Obtener por número
router.get('/orders/number/:orderNumber', OrdersController.getOrderByNumber);

// GET /api/customer/:customerId/orders - Órdenes de cliente
router.get('/customer/:customerId/orders', OrdersController.getCustomerOrders);

// PUT /api/orders/:orderId/status - Actualizar estado (admin)
router.put(
  '/orders/:orderId/status',
  validate(schemas.updateOrderStatus),
  OrdersController.updateOrderStatus
);

// GET /api/orders/:orderId - Obtener detalles de orden
router.get('/orders/:orderId', OrdersController.getOrderById);

/**
 * =========== PAGOS ===========
 */

// POST /api/checkout - Iniciar checkout
router.post(
  '/checkout',
  strictLimiter,
  validate(schemas.initiateCheckout),
  PaymentsController.initiateCheckout
);

// GET /api/orders/:orderId/status - Estado de pago
router.get('/orders/:orderId/status', PaymentsController.getPaymentStatus);

// POST /api/orders/:orderId/retry - Reintentar pago
router.post(
  '/orders/:orderId/retry',
  strictLimiter,
  PaymentsController.retryPayment
);

// POST /api/orders/:orderId/refund - Solicitar reembolso
router.post(
  '/orders/:orderId/refund',
  validate(schemas.refundOrder),
  PaymentsController.refundPayment
);

/**
 * =========== WEBHOOKS ===========
 */

// POST /api/webhooks/mercadopago - Webhook de Mercado Pago
router.post(
  '/webhooks/mercadopago',
  webhookLimiter,
  PaymentsController.handleWebhook
);

/**
 * =========== HEALTH CHECK ===========
 */

// GET /api/health - Estado de la API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

module.exports = router;
