/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas del carrusel de imágenes de la página de inicio.
 * La ruta /public es accesible por todos (frontend público).
 * Las demás requieren autenticación de admin.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Las imágenes no aparecen en el sitio? → Revisar GET /public y obtenerImagenesCarrusel
 * - ¿No se puede cambiar el orden? → Revisar PATCH /reorder y reordenarImagenesCarrusel
 * ======================================================
 */

import express from 'express';
import {
    obtenerImagenesCarrusel,
    obtenerTodasImagenesCarrusel,
    crearImagenCarrusel,
    actualizarImagenCarrusel,
    eliminarImagenCarrusel,
    reordenarImagenesCarrusel
} from '../controllers/carouselController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a gestión del carousel sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden gestionar el carrusel' });
    }
    next();
};

// Ruta pública — el frontend la usa para mostrar las imágenes activas
router.get('/public', obtenerImagenesCarrusel);

// Rutas protegidas — solo admins pueden ver, crear, editar o borrar imágenes
router.get('/', authMiddleware, soloAdmin, obtenerTodasImagenesCarrusel);
router.post('/', authMiddleware, soloAdmin, crearImagenCarrusel);
router.put('/:id', authMiddleware, soloAdmin, actualizarImagenCarrusel);
router.delete('/:id', authMiddleware, soloAdmin, eliminarImagenCarrusel);
router.patch('/reorder', authMiddleware, soloAdmin, reordenarImagenesCarrusel);

export default router;
