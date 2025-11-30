import express from 'express';
import {
    createCheckoutPreference,
    handleWebhook,
    getPaymentStatus
} from '../controllers/mercadoPagoController.js';
import verifyToken from '../middleware/authMiddleware.js';
import verifyMercadoPagoSignature from '../middleware/webhookVerification.js';

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
 * POST /api/mercadopago/webhook - Recibir notificaciones de Mercado Pago
 * NO requiere autenticación (es un webhook público)
 * ✅ PROTEGIDO: Verifica firma de Mercado Pago
 * Mercado Pago enviará datos para notificar cambios de pago
 */
router.post('/webhook', verifyMercadoPagoSignature, handleWebhook);

export default router;
