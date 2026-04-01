/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La ruta que recibe las notificaciones de Mercado Pago sobre pagos.
 * Cada vez que un cliente paga, MP envía una notificación (webhook) a esta URL.
 *
 * ¿CÓMO FUNCIONA?
 * 1. MP envía una solicitud POST con datos del pago.
 * 2. Se verifica que la firma del mensaje sea autentica (HMAC).
 * 3. Se responde 200 immediatamente para que MP no reintente.
 * 4. En segundo plano, se procesa la notificación y se actualiza el pedido.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El pago no se procesa? → Verificar que MERCADO_PAGO_WEBHOOK_SECRET esté configurado
 * - ¿Error de firma inválida? → Revisar validateWebhookSignature en MercadoPagoService
 * - Documentación oficial: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 * ======================================================
 */

import express from 'express';
import logger from '../utils/logger.js';
import MercadoPagoService from '../services/MercadoPagoService.js';
import OrderEventLog from '../models/OrderEventLog.js';
import { webhookLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

// Rate limiting aplicado directamente en el router para que funcione
// incluso cuando esta ruta se monta antes de los middlewares globales de seguridad
router.use(webhookLimiter);

/**
 * Comentarios para el parser JSON del webhook:
 * Esta ruta se monta ANTES del express.json() global,
 * por lo que necesita su propio parser.
 */
router.use(express.json({ limit: '10kb' }));

// ======== WEBHOOK PRINCIPAL ========
// POST /api/webhooks/mercadopago
// Recibe notificaciones de Mercado Pago cuando cambia el estado de un pago.
router.post('/mercadopago', async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.info('Webhook de Mercado Pago recibido', {
            ip: req.ip,
            requestId: req.headers['x-request-id'] || 'sin-id',
            tieneSignature: !!req.headers['x-signature']
        });

        // ======== PASO 1: VERIFICAR QUE EL MENSAJE ES AUTENTICO ========
        // Valida la firma criptográfica del mensaje para rechazar solicitudes falsas
        const isValidSignature = MercadoPagoService.validateWebhookSignature(req.headers, req.query);
        
        if (!isValidSignature) {
            logger.security('Webhook con firma inválida rechazado', { ip: req.ip });
            
            // Registrar el intento sin incluir datos del request para evitar log de información sensible
            await OrderEventLog.create({
                orderId: null,
                eventType: 'webhook_invalid_signature',
                description: 'Intento de webhook con firma inválida',
                metadata: { ip: req.ip, requestId: req.headers['x-request-id'] || null }
            });

            return res.status(401).json({ error: 'Firma inválida' });
        }

        logger.debug('Firma del webhook validada correctamente');

        // ======== PASO 2: RESPONDER A MP INMEDIATAMENTE ========
        // Si tardamos más de 5 segundos, MP va a reintentar el webhook.
        // Por eso respondemos 200 primero y procesamos en segundo plano.
        res.status(200).json({ 
            success: true, 
            message: 'Notificación recibida',
            timestamp: new Date().toISOString()
        });

        // ======== PASO 3: PROCESAR EN SEGUNDO PLANO ========
        // No bloquea la respuesta HTTP ya enviada arriba
        setImmediate(async () => {
            try {
                const result = await MercadoPagoService.processWebhookNotification(req.body);
                const processingTime = Date.now() - startTime;
                logger.info('Webhook procesado exitosamente', { processingTimeMs: processingTime, result });

            } catch (error) {
                logger.error('Error procesando webhook en segundo plano', { message: error.message });
                
                // Registrar el error para poder revisarlo luego en el historial del pedido
                await OrderEventLog.create({
                    orderId: null,
                    eventType: 'webhook_processing_error',
                    description: `Error procesando webhook: ${error.message}`,
                    metadata: { message: error.message }
                });
            }
        });

    } catch (error) {
        logger.error('Error crítico en recepción de webhook', { message: error.message });
        
        if (res.headersSent) return;

        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * ✅ ENDPOINT DE PRUEBA (solo desarrollo)
 * GET /api/webhooks/mercadopago/test
 */
if (process.env.NODE_ENV !== 'production') {
    router.get('/mercadopago/test', (req, res) => {
        res.json({
            message: 'Webhook de Mercado Pago funcionando',
            environment: process.env.NODE_ENV,
            webhook_url: process.env.BACKEND_URL + '/api/webhooks/mercadopago',
            timestamp: new Date().toISOString()
        });
    });
}

export default router;
