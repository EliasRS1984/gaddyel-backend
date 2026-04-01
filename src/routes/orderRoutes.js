/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas de pedidos. Algunas son públicas (crear pedido, ver pedidos propios)
 * y otras son solo para admins (listar todo, cambiar estado, eliminar).
 *
 * ¿CÓMO FUNCIONA?
 * El router aplica autenticación a partir de la línea router.use(verifyToken).
 * Las rutas declaradas antes de esa línea son públicas.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se crea el pedido? → Revisar createOrder en orderController
 * - ¿El estado no cambia? → Revisar updateOrderStatus en orderController
 * ======================================================
 */

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
import logger from '../utils/logger.js';

const router = express.Router();

// ======== VERIFICACIÓN DE ROL (solo para la sección admin) ========
// Se aplica DESPUÉS de verifyToken, únicamente a las rutas que siguen.
// Las rutas públicas declaradas arriba no se ven afectadas.
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a gestión de pedidos sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden acceder a esta sección' });
    }
    next();
};

// Crear nuevo pedido (público, con rate limiting)
router.post('/crear', createOrderLimiter, createOrder);

// Ver pedidos de un cliente específico por su ID (público, con rate limiting)
router.get('/cliente/:clienteId', searchLimiter, getClientOrders);

// A partir de aquí: solo admins autenticados
router.use(verifyToken);
router.use(soloAdmin);

// Listar todas las órdenes sin paginación (para el dashboard de estadísticas)
// IMPORTANTE: debe ir antes de GET /:id para evitar conflicto de rutas
router.get('/all', getOrdersNoPagination);

// Listar pedidos con filtros y paginación (panel admin)
router.get('/', getOrders);

// Ver detalle de un pedido por ID
router.get('/:id', getOrderById);

// Actualizar estado del pedido (en_produccion, enviado, entregado)
router.put('/:id/estado', updateOrderStatus);

// Eliminar un pedido (requiere confirmación con contraseña del admin)
router.delete('/:id', deleteOrder);

export default router;
