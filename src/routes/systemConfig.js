/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas de configuración global del sistema.
 * Permiten al admin ajustar envío, comisiones y ejecutar
 * las herramientas de migración de precios.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los precios no cambian al actualizar la tasa? → Revisar PUT / en systemConfigController
 * - ¿La migración de precios falla? → Revisar POST /migrate-pricing
 * ======================================================
 */

import express from 'express';
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreviewPrecio,
  migrarPrecios,
  recalcularPrecios,
  limpiarEstructuraPrecios
} from '../controllers/systemConfigController.js';
import verifyToken from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
// Estas rutas controlan migración de precios y configuración global del sistema.
// Son las rutas más sensibles del backend: un acceso no autorizado podría
// recalcular todos los precios o corromper la estructura de datos.
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a configuración del sistema sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden acceder a esta configuración' });
    }
    next();
};

router.use(verifyToken);
router.use(soloAdmin);

router.get('/', obtenerConfiguracion);
router.put('/', actualizarConfiguracion);
router.get('/historial', obtenerHistorial);
router.post('/preview-precio', calcularPreviewPrecio);
router.post('/migrate-pricing', migrarPrecios);
router.post('/recalcular-precios', recalcularPrecios);
router.post('/limpiar-estructura', limpiarEstructuraPrecios);

export default router;
