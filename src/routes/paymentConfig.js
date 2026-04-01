/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas de configuración de comisiones de pago.
 * Permiten al admin ver y cambiar la tasa de comisión de Mercado Pago.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El precio no se recalcula al cambiar la tasa? → Revisar PUT / en paymentConfigController
 * - ¿El preview no está bien calculado? → Revisar POST /preview
 * ======================================================
 */

import express from 'express';
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreview
} from '../controllers/paymentConfigController.js';
import verifyToken from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
// Todas las rutas de este archivo modifican la configuración financiera de la tienda.
// Solo admins pueden acceder. Se verifica DESPUÉS de validar el token,
// porque si no hay token válido verifyToken ya detiene la petición antes.
// Sin esta verificación, un cliente con sesión iniciada podría cambiar las tasas
// de comisión al descubrir estos endpoints (mismo secreto JWT para admin y cliente).
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a configuración de pagos sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden acceder a esta configuración' });
    }
    next();
};

// Primero verificar token válido, luego verificar que sea admin
router.use(verifyToken);
router.use(soloAdmin);

router.get('/', obtenerConfiguracion);
router.put('/', actualizarConfiguracion);
router.get('/historial', obtenerHistorial);
router.post('/preview', calcularPreview);

export default router;
