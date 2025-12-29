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

const router = express.Router();

// ✅ Ruta pública - Frontend obtiene imágenes activas
router.get('/public', obtenerImagenesCarrusel);

// ✅ Rutas protegidas - Solo admin (requiere autenticación)
router.get('/', authMiddleware, obtenerTodasImagenesCarrusel);
router.post('/', authMiddleware, crearImagenCarrusel);
router.put('/:id', authMiddleware, actualizarImagenCarrusel);
router.delete('/:id', authMiddleware, eliminarImagenCarrusel);
router.patch('/reorder', authMiddleware, reordenarImagenesCarrusel);

export default router;
