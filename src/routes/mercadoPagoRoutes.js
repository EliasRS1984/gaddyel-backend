import express from 'express';
import {
    createCheckoutPreference,
    getPaymentStatus
} from '../controllers/mercadoPagoController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/mercadopago/preferences - Crear preferencia de pago
 * Body: { ordenId, items, datosComprador }
 * Requiere autenticación
 */
router.post('/preferences', verifyToken, createCheckoutPreference);

/**
 * GET /api/mercadopago/payment/:ordenId - Obtener estado del pago
 * Requiere autenticación
 */
router.get('/payment/:ordenId', verifyToken, getPaymentStatus);

/**
 * POST /api/mercadopago/webhook
 * ⚠️ REGISTRADO EN index.js ANTES de middleware global
 * Necesita raw body para verificar firma HMAC
 */

export default router;
