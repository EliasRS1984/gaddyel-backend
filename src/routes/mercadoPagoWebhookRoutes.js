import express from 'express';
import MercadoPagoService from '../services/MercadoPagoService.js';
import OrderEventLog from '../models/OrderEventLog.js';

const router = express.Router();

/**
 * ✅ WEBHOOK DE MERCADO PAGO
 * POST /api/webhooks/mercadopago
 * 
 * SEGURIDAD 2025:
 * - Validación obligatoria de x-signature
 * - Procesamiento asíncrono para evitar timeouts
 * - Idempotencia para evitar procesamiento duplicado
 * - Rate limiting en el middleware principal
 * 
 * Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('\n🔔 [Webhook MP] ===== NUEVA NOTIFICACIÓN =====');
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        console.log(`   IP: ${req.ip}`);
        console.log(`   Query Params:`, req.query);
        console.log(`   Headers:`, {
            'x-signature': req.headers['x-signature'] ? '✅ Presente' : '❌ Faltante',
            'x-request-id': req.headers['x-request-id'] ? '✅ Presente' : '❌ Faltante',
            'content-type': req.headers['content-type']
        });
        console.log(`   Body:`, JSON.stringify(req.body, null, 2));

        // ✅ PASO 1: Validar firma del webhook
        const isValidSignature = MercadoPagoService.validateWebhookSignature(req.headers, req.body);
        
        if (!isValidSignature) {
            console.log('   ❌ Firma inválida - Rechazando webhook');
            
            // Registrar intento sospechoso
            await OrderEventLog.create({
                orderId: null,
                eventType: 'webhook_invalid_signature',
                description: 'Intento de webhook con firma inválida',
                metadata: {
                    headers: req.headers,
                    body: req.body,
                    ip: req.ip
                }
            });

            return res.status(401).json({ 
                error: 'Firma inválida',
                message: 'La firma del webhook no pudo ser validada'
            });
        }

        console.log('   ✅ Firma validada correctamente');

        // ✅ PASO 2: Responder inmediatamente a Mercado Pago (200 OK)
        // Esto evita que MP reintente por timeout
        res.status(200).json({ 
            success: true, 
            message: 'Notificación recibida',
            timestamp: new Date().toISOString()
        });

        // ✅ PASO 3: Procesar notificación de forma asíncrona
        // No bloquear la respuesta HTTP
        setImmediate(async () => {
            try {
                const result = await MercadoPagoService.processWebhookNotification(req.body);
                
                const processingTime = Date.now() - startTime;
                console.log(`   ✅ Webhook procesado en ${processingTime}ms`);
                console.log(`   Resultado:`, result);

            } catch (error) {
                console.error('   ❌ Error procesando webhook:', error);
                
                // Registrar error pero no fallar la respuesta HTTP
                await OrderEventLog.create({
                    orderId: null,
                    eventType: 'webhook_processing_error',
                    description: `Error procesando webhook: ${error.message}`,
                    metadata: {
                        error: error.message,
                        stack: error.stack,
                        body: req.body
                    }
                });
            }
        });

    } catch (error) {
        console.error('   ❌ Error crítico en webhook:', error);
        
        // Si ya enviamos respuesta, no hacer nada más
        if (res.headersSent) {
            return;
        }

        // Error antes de enviar respuesta
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

/**
 * ✅ ENDPOINT DE PRUEBA (solo desarrollo)
 * GET /api/webhooks/mercadopago/test
 */
if (process.env.NODE_ENV !== 'production') {
    router.get('/test', (req, res) => {
        res.json({
            message: 'Webhook de Mercado Pago funcionando',
            environment: process.env.NODE_ENV,
            webhook_url: process.env.BACKEND_URL + '/api/webhooks/mercadopago',
            timestamp: new Date().toISOString()
        });
    });
}

export default router;
