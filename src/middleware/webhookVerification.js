import crypto from 'crypto';

/**
 * Middleware para verificar la firma de webhooks de Mercado Pago
 * 
 * Mercado Pago envía:
 * - X-Signature: HMAC-SHA256 del request
 * - X-Request-Id: ID único del request
 * 
 * El header X-Signature tiene formato: ts=timestamp,v1=signature
 */
export const verifyMercadoPagoSignature = (req, res, next) => {
    try {
        const signature = req.headers['x-signature'];
        const requestId = req.headers['x-request-id'];
        const timestamp = req.headers['x-timestamp'];

        // Validar que headers existan
        if (!signature || !requestId || !timestamp) {
            console.warn('❌ Webhook: Headers de seguridad faltantes');
            return res.status(400).json({ 
                error: 'Missing required headers: x-signature, x-request-id, x-timestamp' 
            });
        }

        // El secret key viene de credenciales de Mercado Pago
        const secretKey = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
        if (!secretKey) {
            console.error('❌ MERCADO_PAGO_WEBHOOK_SECRET no configurado');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Parsear X-Signature (formato: ts=1234567890,v1=abc123...)
        const signatureParts = signature.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            acc[key.trim()] = value.trim();
            return acc;
        }, {});

        const receivedSignature = signatureParts.v1;
        if (!receivedSignature) {
            console.warn('❌ Webhook: Firma v1 no encontrada');
            return res.status(400).json({ error: 'Invalid signature format' });
        }

        // Construir el payload a verificar: {request-id}.{timestamp}.{body-as-string}
        const payload = `${requestId}.${timestamp}.${JSON.stringify(req.body)}`;

        // Generar el HMAC-SHA256
        const expectedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(payload)
            .digest('hex');

        // Comparar las firmas usando comparison seguro (timing-safe)
        const isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(receivedSignature)
        );

        if (!isValid) {
            console.warn(`❌ Webhook: Firma inválida. Esperado: ${expectedSignature.substring(0, 10)}..., Recibido: ${receivedSignature.substring(0, 10)}...`);
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log(`✅ Webhook signature válida para request: ${requestId}`);
        next();

    } catch (err) {
        console.error('❌ Error verificando firma de webhook:', err.message);
        
        // No lanzar error interno, simplemente rechazar
        return res.status(401).json({ error: 'Signature verification failed' });
    }
};

/**
 * Información sobre cómo obtener MERCADO_PAGO_WEBHOOK_SECRET:
 * 
 * 1. Ir a: https://www.mercadopago.com/developers/es/docs/checkout-pro/integrations/notifications/webhooks
 * 2. En la sección "Credenciales de Webhook", encontrarás el "Webhook Secret Key"
 * 3. Configurar en .env: MERCADO_PAGO_WEBHOOK_SECRET=tu_secret_key
 * 
 * Para testing local:
 * - Usar webhookbot.com o ngrok para exponer local a internet
 * - Usar Postman para simular webhooks con headers correctos
 * 
 * Para producción:
 * - Configurar URL pública en dashboard de Mercado Pago
 * - Usar secret key de producción (no sandbox)
 */

export default verifyMercadoPagoSignature;
