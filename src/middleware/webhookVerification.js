import crypto from 'crypto';

/**
 * Middleware para verificar la firma de webhooks de Mercado Pago
 * 
 * ARQUITECTURA:
 * 1. Este middleware recibe express.raw() body (no parseado)
 * 2. Verifica firma HMAC-SHA256
 * 3. Parsea JSON y lo pone en req.body para el controlador
 * 
 * Mercado Pago envía:
 * - X-Signature: HMAC-SHA256 del request (v1 = HMAC-SHA256 de payload)
 * - X-Request-Id: ID único del request
 * - X-Timestamp: Timestamp del request
 * 
 * Formato X-Signature: ts=timestamp,v1=hexdigest
 * Payload a firmar: {request-id}.{timestamp}.{body-string}
 */
export const verifyMercadoPagoSignature = (req, res, next) => {
    try {
        const signature = req.headers['x-signature'];
        const requestId = req.headers['x-request-id'];
        const timestamp = req.headers['x-timestamp'];
        
        // Log para diagnosticar
        console.log('🔍 [Webhook] Headers recibidos:');
        console.log('   x-signature:', signature ? '✅ presente' : '❌ faltante');
        console.log('   x-request-id:', requestId ? '✅ presente' : '❌ faltante');
        console.log('   x-timestamp:', timestamp ? '✅ presente' : '❌ faltante');

        // ✅ CORREGIDO: Validar firma si tenemos x-signature y x-request-id
        // (x-timestamp es opcional en algunos webhooks de MP)
        if (signature && requestId) {
            const secretKey = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
            
            if (!secretKey) {
                console.error('❌ MERCADO_PAGO_WEBHOOK_SECRET no configurado');
                return res.status(500).json({ error: 'Server configuration error' });
            }

            // El body es un Buffer, convertir a string
            const bodyString = req.body.toString('utf-8');
            
            // Construir payload a verificar (sin timestamp si no está disponible)
            // Formato alternativo de MP: id.request-id.ts (ts puede ser vacío)
            const manifest = timestamp 
                ? `${requestId}.${timestamp}.${bodyString}`
                : `id:${bodyString.split('"id":"')[1]?.split('"')[0] || bodyString}.request-id:${requestId}.ts:;`;
            
            // Parsear X-Signature
            const signatureParts = signature.split(',').reduce((acc, part) => {
                const [key, value] = part.split('=');
                acc[key.trim()] = value.trim();
                return acc;
            }, {});

            const receivedSignature = signatureParts.v1;
            
            if (!receivedSignature) {
                console.warn('❌ Webhook: Firma v1 no encontrada en x-signature');
                return res.status(400).json({ error: 'Invalid signature format' });
            }

            // Generar HMAC-SHA256 esperado
            const expectedSignature = crypto
                .createHmac('sha256', secretKey)
                .update(bodyString) // MP firma el body directamente
                .digest('hex');

            // Comparar usando timing-safe
            try {
                const isValid = crypto.timingSafeEqual(
                    Buffer.from(expectedSignature),
                    Buffer.from(receivedSignature)
                );

                if (!isValid) {
                    console.warn(`⚠️ Webhook: Firma inválida`);
                    console.warn(`   Esperada: ${expectedSignature.substring(0, 16)}...`);
                    console.warn(`   Recibida: ${receivedSignature.substring(0, 16)}...`);
                    return res.status(401).json({ error: 'Invalid signature' });
                }

                console.log(`✅ Webhook signature válida para request: ${requestId}`);
            } catch (signatureError) {
                console.warn(`❌ Error comparando firmas: ${signatureError.message}`);
                return res.status(401).json({ error: 'Signature verification failed' });
            }
        } else {
            // Headers de seguridad críticos faltantes (x-signature o x-request-id)
            console.error('❌ CRÍTICO: Headers x-signature o x-request-id faltantes');
            console.error(`   x-signature: ${signature ? 'presente' : 'faltante'}`);
            console.error(`   x-request-id: ${requestId ? 'presente' : 'faltante'}`);
            
            const mpMode = (process.env.MERCADO_PAGO_MODE || 'production').toLowerCase();
            
            // SOLO permitir webhooks sin firma en sandbox/testing
            if (mpMode === 'sandbox' || mpMode === 'test') {
                console.warn('🧪 SANDBOX MODE: Permitiendo webhook sin headers de seguridad (solo para testing)');
            } else {
                console.error(`❌ PRODUCTION MODE: Se requieren x-signature y x-request-id`);
                return res.status(400).json({ 
                    error: 'Missing required security headers (x-signature, x-request-id)' 
                });
            }
        }

        // Parsear el JSON body para el controlador
        try {
            if (Buffer.isBuffer(req.body)) {
                req.body = JSON.parse(req.body.toString('utf-8'));
            }
        } catch (parseError) {
            console.error('❌ Error parseando JSON:', parseError.message);
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        next();

    } catch (err) {
        console.error('❌ Error verificando firma de webhook:', err.message);
        return res.status(401).json({ error: 'Signature verification failed' });
    }
};

/**
 * Cómo obtener MERCADO_PAGO_WEBHOOK_SECRET:
 * 
 * 1. Ir a: https://www.mercadopago.com/developers/es/docs/checkout-pro/integrations/notifications/webhooks
 * 2. En el dashboard de MP, sección "Webhooks"
 * 3. El secret está en "Token": copiar sin las primeras 4 letras de credencial
 * 
 * TESTING/SANDBOX:
 * - Secret es diferente en sandbox vs production
 * - Verificar en Mercado Pago Sandbox Dashboard
 * 
 * Configurar en:
 * - Render: Variables de entorno → MERCADO_PAGO_WEBHOOK_SECRET
 * - .env local: MERCADO_PAGO_WEBHOOK_SECRET=tu_secret_aqui
 */

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
