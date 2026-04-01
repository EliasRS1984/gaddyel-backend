/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas para crear pagos y consultar su estado en Mercado Pago.
 * Requieren autenticación del cliente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se crea la preferencia de pago? → Revisar createCheckoutPreference en mercadoPagoController
 * - ¿El estado del pago no actualiza? → Verificar que el webhook esté funcionando en mercadoPagoWebhookRoutes
 * ======================================================
 */

import express from 'express';
import {
    createCheckoutPreference,
    getPaymentStatus
} from '../controllers/mercadoPagoController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

// Crear preferencia de pago (requiere autenticación)
router.post('/preferences', verifyToken, createCheckoutPreference);

// Consultar estado del pago de una orden (requiere autenticación)
router.get('/payment/:ordenId', verifyToken, getPaymentStatus);

export default router;
