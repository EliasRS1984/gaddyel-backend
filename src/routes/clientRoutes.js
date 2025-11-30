import express from 'express';
import {
    getClients,
    getClientById,
    updateClient,
    deleteClient,
    getClientHistory,
    getClientStats
} from '../controllers/clientController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas las rutas de clientes requieren autenticación admin
router.use(verifyToken);

/**
 * GET /api/clientes - Listar clientes con filtros
 * Query params: buscar, orderBy, orden, pagina, limite
 */
router.get('/', getClients);

/**
 * GET /api/clientes/estadisticas - Estadísticas generales
 */
router.get('/estadisticas', getClientStats);

/**
 * GET /api/clientes/:id - Obtener cliente por ID
 */
router.get('/:id', getClientById);

/**
 * GET /api/clientes/:id/historial - Historial de pedidos del cliente
 */
router.get('/:id/historial', getClientHistory);

/**
 * PUT /api/clientes/:id - Actualizar cliente
 */
router.put('/:id', updateClient);

/**
 * DELETE /api/clientes/:id - Desactivar cliente
 */
router.delete('/:id', deleteClient);

export default router;
