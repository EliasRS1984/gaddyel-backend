const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const webhookController = require('../controllers/webhookController');
const authMiddleware = require('../middleware/auth');

// ==================== ÓRDENES ====================

// Crear orden (público)
router.post('/api/orders/create', orderController.createOrder);

// Obtener orden por ID (público)
router.get('/api/orders/:id', orderController.getOrder);

// Reintentar pago (público)
router.post('/api/orders/:id/retry', orderController.retryPayment);

// ==================== ÓRDENES (ADMIN) ====================

// Listar órdenes (requiere autenticación)
router.get('/api/admin/orders', authMiddleware, orderController.listOrders);

// Cambiar estado de orden (admin)
router.patch('/api/admin/orders/:id/status', authMiddleware, orderController.updateOrderStatus);

// Obtener auditoría de orden (admin)
router.get('/api/admin/orders/:id/audit', authMiddleware, orderController.getOrderAudit);

// Dashboard stats (admin)
router.get('/api/admin/dashboard/stats', authMiddleware, orderController.getDashboardStats);

// ==================== WEBHOOKS ====================

// Webhook de Mercado Pago
router.post('/api/webhooks/mercadopago', webhookController.handleWebhook);

// Webhook de prueba (solo desarrollo)
if (process.env.NODE_ENV === 'development') {
  router.post('/api/webhooks/test', webhookController.testWebhook);
}

module.exports = router;
