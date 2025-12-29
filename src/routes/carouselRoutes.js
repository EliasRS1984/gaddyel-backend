import express from 'express';
import {
    obtenerImagenesCarrusel,
    obtenerTodasImagenesCarrusel,
    crearImagenCarrusel,
    actualizarImagenCarrusel,
    eliminarImagenCarrusel,
    reordenarImagenesCarrusel
} from '../controllers/carouselController.js';
import { verificarToken, verificarAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Ruta pública - Frontend obtiene imágenes activas
router.get('/public', obtenerImagenesCarrusel);

// ✅ Rutas protegidas - Solo admin
router.get('/', verificarToken, verificarAdmin, obtenerTodasImagenesCarrusel);
router.post('/', verificarToken, verificarAdmin, crearImagenCarrusel);
router.put('/:id', verificarToken, verificarAdmin, actualizarImagenCarrusel);
router.delete('/:id', verificarToken, verificarAdmin, eliminarImagenCarrusel);
router.patch('/reorder', verificarToken, verificarAdmin, reordenarImagenesCarrusel);

export default router;
