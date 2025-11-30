import express from 'express';
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getClientOrders
} from '../controllers/orderController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/pedidos/crear - Crear nuevo pedido (público)
 * NO requiere autenticación
 */
router.post('/crear', createOrder);

/**
 * GET /api/pedidos/cliente/:clienteId - Obtener pedidos de un cliente (público)
 * El cliente ve solo sus propios pedidos
 */
router.get('/cliente/:clienteId', getClientOrders);

// Rutas protegidas (admin)
router.use(verifyToken);

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

export default router;
