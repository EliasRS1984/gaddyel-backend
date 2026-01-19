import express from 'express';
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getClientOrders,
    deleteOrder,
    getOrdersNoPagination
} from '../controllers/orderController.js';
import verifyToken from '../middleware/authMiddleware.js';
import { createOrderLimiter, searchLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

/**
 * POST /api/pedidos/crear - Crear nuevo pedido (público)
 * NO requiere autenticación
 * ✅ PROTEGIDO: Rate limiting (10 pedidos/15min por IP)
 */
router.post('/crear', createOrderLimiter, createOrder);

/**
 * GET /api/pedidos/cliente/:clienteId - Obtener pedidos de un cliente (público)
 * El cliente ve solo sus propios pedidos
 * ✅ PROTEGIDO: Rate limiting (30 búsquedas/15min por IP)
 */
router.get('/cliente/:clienteId', searchLimiter, getClientOrders);

// Rutas protegidas (admin)
router.use(verifyToken);

/**
 * ✅ NUEVO: GET /api/pedidos/all - Listar TODAS las órdenes sin paginación
 * Usado por Dashboard para estadísticas
 * IMPORTANTE: Debe ir antes de GET /api/pedidos/:id para evitar conflicto de rutas
 */
router.get('/all', getOrdersNoPagination);

/**
 * GET /api/pedidos - Listar todos los pedidos (admin)
 * Query params: estadoPago, estadoPedido, fechaDesde, fechaHasta, pagina, limite
 */
router.get('/', getOrders);

/**
 * GET /api/pedidos/:id - Obtener un pedido por ID (admin)
 */
router.get('/:id', getOrderById);

/**
 * PUT /api/pedidos/:id/estado - Actualizar estado del pedido (admin)
 * Body: { estadoPedido, notasAdmin, fechaEntregaEstimada }
 */
router.put('/:id/estado', updateOrderStatus);

/**
 * DELETE /api/pedidos/:id - Eliminar un pedido (admin - requiere contraseña)
 * Body: { password }
 * Registra la eliminación en el historial de estados
 */
router.delete('/:id', deleteOrder);

export default router;
