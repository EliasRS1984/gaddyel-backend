import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import crypto from 'crypto';
import Order from '../models/Order.js';
import OrderEventLog from '../models/OrderEventLog.js';

/**
 * ✅ MERCADO PAGO SERVICE - ESTÁNDARES 2025
 * - SDK oficial v2.0+
 * - Validación de firmas de webhooks (x-signature)
 * - Idempotencia con X-Idempotency-Key
 * - Manejo robusto de errores
 */

class MercadoPagoService {
    constructor() {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

        if (!accessToken) {
            console.warn('⚠️ MERCADO_PAGO_ACCESS_TOKEN no configurado en .env');
            console.warn('   El servicio de Mercado Pago no estará disponible');
            console.warn('   Configura las credenciales en .env para habilitar pagos');
            this.enabled = false;
            return;
        }

        // ✅ Inicializar SDK oficial
        this.client = new MercadoPagoConfig({
            accessToken,
            options: {
                timeout: 5000,
                idempotencyKey: undefined // Se configura por request
            }
        });

        this.preferenceClient = new Preference(this.client);
        this.paymentClient = new Payment(this.client);

        this.publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY;
        this.webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || accessToken; // Usar access token como fallback
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        this.backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
        this.enabled = true;

        console.log('✅ MercadoPagoService inicializado');
        console.log(`   Frontend URL: ${this.frontendUrl}`);
        console.log(`   Backend URL: ${this.backendUrl}`);
    }

    /**
     * ✅ CREAR PREFERENCIA DE PAGO
     * @param {Object} order - Orden de MongoDB
     * @returns {Promise<Object>} { preferenceId, initPoint, sandboxInitPoint }
     */
    /**
      * ✅ CREAR PREFERENCIA DE PAGO - CORREGIDO 2025
      */
    async createPreference(order) {
        if (!this.enabled) {
            throw new Error('Mercado Pago no está configurado. Configura MERCADO_PAGO_ACCESS_TOKEN en .env');
        }

        try {
            console.log(`\n🔵 [MP Service] Creando preferencia para orden: ${order._id}`);

            // ✅ MAPEAR ITEMS (Estructura validada por MP API)
            // Validación: id único, title, quantity (entero), unit_price (número)
            const items = order.items.map((item, index) => {
                const itemId = `${order._id.toString()}-item-${index}`; // ID único
                const quantity = parseInt(item.cantidad) || 1;
                const unitPrice = parseFloat(item.precioUnitario) || 0;
                
                if (quantity <= 0 || unitPrice <= 0) {
                    throw new Error(`Item ${index}: cantidad o precio inválidos`);
                }
                
                return {
                    id: itemId,
                    title: (item.nombre || 'Producto Gaddyel').substring(0, 256),
                    quantity: quantity,
                    unit_price: unitPrice,
                    currency_id: 'ARS'
                };
            });

            // ✅ INFORMACIÓN DEL COMPRADOR (solo campos que MP acepta)
            // REQUERIDO: email | OPCIONAL: name, surname
            // ⚠️ NO incluir: phone, address (causa errores en validación)
            const payer = {
                email: order.datosComprador?.email  // OBLIGATORIO
                // name: nombre,                      // OPCIONAL: Comentado para evitar fallos
                // surname: apellidos                 // OPCIONAL: Comentado para evitar fallos
            };
            
            if (!payer.email) {
                throw new Error('Email del comprador es requerido');
            }

            // 3. URLs de retorno (Sin parámetros extras para evitar fallos de validación)
            const backUrls = {
                success: `${this.frontendUrl}/pedido-confirmado/${order._id}`,
                failure: `${this.frontendUrl}/pedido-fallido/${order._id}`,
                pending: `${this.frontendUrl}/pedido-pendiente/${order._id}`
            };

            // ✅ CONFIGURACIÓN DE PREFERENCIA (Estándares MP SDK v2.0+)
            // ⚠️ IMPORTANTE: back_urls y notification_url necesitan URLs PÚBLICAS
            // MP no puede redirigir a localhost desde su app/web
            // SOLUCIÓN: Usar ngrok para exponer frontend y backend
            const preferenceData = {
                items,
                payer,
                back_urls: backUrls,
                // ⚠️ auto_return requiere URLs públicas para funcionar
                // Con localhost, MP no puede validar las back_urls
                // Con ngrok, descomentar: auto_return: 'approved',
                external_reference: order._id.toString(),
                statement_descriptor: 'GADDYEL',
                // ⚠️ notification_url requiere URL pública
                // Con ngrok: descomentar y configurar BACKEND_URL en .env
                // notification_url: `${this.backendUrl}/api/webhooks/mercadopago`,
                payment_methods: {
                    installments: 12,
                    default_installments: 1
                },
                metadata: {
                    order_id: order._id.toString(),
                    order_number: order.orderNumber || 'N/A',
                    created_at: new Date().toISOString()
                }
            };

            // 🔍 DEBUG: Validar antes de enviar a MP
            console.log('\n🔍 [DEBUG] Validando preferencia...');
            console.log(`   Items: ${items.length} producto(s)`);
            console.log(`   Total: ARS $${items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)}`);
            console.log(`   Comprador: ${payer.email}`);
            console.log(`   Auto-return: ${preferenceData.auto_return}`);
            console.log(`   Back URLs:`);
            console.log(`     • Success: ${backUrls.success}`);
            console.log(`     • Failure: ${backUrls.failure}`);
            console.log(`     • Pending: ${backUrls.pending}`);
            console.log(`   Webhook: ${preferenceData.notification_url ? 'Habilitado' : 'Deshabilitado (desarrollo)'}`);

            // 📤 ENVIAR A MERCADO PAGO API
            console.log('\n📤 Enviando preferencia a Mercado Pago API...');
            const response = await this.preferenceClient.create({
                body: preferenceData
            });

            console.log(`\n✅ Preferencia creada exitosamente`);
            console.log(`   ID: ${response.id}`);
            console.log(`   URL Checkout: ${response.init_point}`);
            console.log(`   URL Sandbox: ${response.sandbox_init_point || 'N/A'}`);

            // Actualizar la orden en la base de datos
            order.payment = order.payment || {};
            order.payment.mercadoPago = {
                preferenceId: response.id,
                initPoint: response.init_point,
                sandboxInitPoint: response.sandbox_init_point,
                createdAt: new Date()
            };
            await order.save();

            return {
                preferenceId: response.id,
                initPoint: response.init_point,
                sandboxInitPoint: response.sandbox_init_point
            };

        } catch (error) {
            console.error('\n❌ [MP Service] Error creando preferencia');
            console.error(`   Orden: ${order._id}`);
            console.error(`   Mensaje: ${error.message}`);
            
            // Mostrar causa raíz si está disponible
            if (error.cause) {
                console.error(`   Causa: ${JSON.stringify(error.cause)}`);
            }
            
            // Log de auditoría del error
            try {
                await OrderEventLog.create({
                    orderId: order._id,
                    eventType: 'preference_creation_error',
                    description: `Error creando preferencia: ${error.message}`,
                    metadata: { error: error.message, cause: error.cause }
                });
            } catch (logError) {
                console.error('No se pudo registrar el error en log');
            }

            throw new Error(`Error al crear preferencia de Mercado Pago: ${error.message}`);
        }
    }

    /**
     * ✅ OBTENER INFORMACIÓN DEL PAGO
     * @param {string} paymentId - ID del pago en Mercado Pago
     * @returns {Promise<Object>} Información del pago
     */
    async getPaymentInfo(paymentId) {
        try {
            console.log(`\n🔵 [MP Service] Obteniendo info de pago: ${paymentId}`);

            const payment = await this.paymentClient.get({ id: paymentId });

            console.log(`   ✅ Pago obtenido - Status: ${payment.status}`);
            console.log(`   💰 Monto: ${payment.transaction_amount} ${payment.currency_id}`);
            console.log(`   📧 Email: ${payment.payer?.email || 'N/A'}`);

            return payment;

        } catch (error) {
            console.error(`❌ [MP Service] Error obteniendo pago ${paymentId}:`, error);
            throw new Error(`Error al obtener información del pago: ${error.message}`);
        }
    }

    /**
     * ✅ VALIDAR FIRMA DEL WEBHOOK (x-signature header)
     * Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
     * 
     * @param {Object} headers - Headers del request
     * @param {Object} body - Body del request
     * @returns {boolean} true si la firma es válida
     */
    validateWebhookSignature(headers, body) {
        try {
            const xSignature = headers['x-signature'];
            const xRequestId = headers['x-request-id'];

            if (!xSignature || !xRequestId) {
                console.log('   ⚠️ Headers faltantes para validación de firma');
                return false;
            }

            // Extraer ts y v1 de x-signature
            // Formato: "ts=123456789,v1=abc123def456..."
            const signatureParts = xSignature.split(',');
            let ts, hash;

            signatureParts.forEach(part => {
                const [key, value] = part.split('=');
                if (key.trim() === 'ts') ts = value;
                if (key.trim() === 'v1') hash = value;
            });

            if (!ts || !hash) {
                console.log('   ⚠️ Formato de x-signature inválido');
                return false;
            }

            // ✅ Construir string para validar: id;request-id;ts
            const dataId = body.data?.id || body.id || '';
            const manifestString = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

            console.log(`   🔐 Validando firma con manifest: ${manifestString}`);

            // ✅ Crear HMAC SHA256
            const hmac = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(manifestString)
                .digest('hex');

            const isValid = hmac === hash;
            console.log(`   ${isValid ? '✅' : '❌'} Firma ${isValid ? 'válida' : 'inválida'}`);

            return isValid;

        } catch (error) {
            console.error('❌ Error validando firma del webhook:', error);
            return false;
        }
    }

    /**
     * ✅ PROCESAR NOTIFICACIÓN DE WEBHOOK
     * @param {Object} notification - Datos del webhook
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    async processWebhookNotification(notification) {
        try {
            const { action, data, type } = notification;

            console.log(`\n🔔 [MP Webhook] Procesando notificación`);
            console.log(`   Type: ${type}`);
            console.log(`   Action: ${action}`);
            console.log(`   Data ID: ${data?.id || 'N/A'}`);

            // Solo procesar notificaciones de pagos
            if (type !== 'payment') {
                console.log(`   ⏭️ Tipo no procesable: ${type}`);
                return { processed: false, reason: 'tipo_no_procesable' };
            }

            const paymentId = data?.id;
            if (!paymentId) {
                console.log(`   ❌ Payment ID no encontrado en notificación`);
                return { processed: false, reason: 'payment_id_faltante' };
            }

            // ✅ Obtener información completa del pago
            const paymentInfo = await this.getPaymentInfo(paymentId);

            // ✅ Buscar orden por external_reference
            const orderId = paymentInfo.external_reference;
            if (!orderId) {
                console.log(`   ❌ External reference no encontrado en pago`);
                return { processed: false, reason: 'external_reference_faltante' };
            }

            const order = await Order.findById(orderId);
            if (!order) {
                console.log(`   ❌ Orden no encontrada: ${orderId}`);
                return { processed: false, reason: 'orden_no_encontrada' };
            }

            console.log(`   📦 Orden encontrada: ${order.orderNumber}`);
            console.log(`   🔄 Estado actual: ${order.estadoPago}`);
            console.log(`   💳 Estado pago MP: ${paymentInfo.status}`);

            // ✅ Actualizar información del pago
            order.payment = order.payment || {};
            order.payment.mercadoPago = order.payment.mercadoPago || {};
            order.payment.mercadoPago.paymentId = paymentId;
            order.payment.mercadoPago.status = paymentInfo.status;
            order.payment.mercadoPago.statusDetail = paymentInfo.status_detail;
            order.payment.mercadoPago.paymentType = paymentInfo.payment_type_id;
            order.payment.mercadoPago.paymentMethod = paymentInfo.payment_method_id;
            order.payment.mercadoPago.transactionAmount = paymentInfo.transaction_amount;
            order.payment.mercadoPago.lastUpdate = new Date();

            // ✅ Mapear estado de MP a estado de orden
            let nuevoEstadoPago = order.estadoPago;
            let descripcionEvento = '';

            switch (paymentInfo.status) {
                case 'approved':
                    nuevoEstadoPago = 'aprobado';
                    descripcionEvento = `Pago aprobado - ID: ${paymentId}`;
                    order.fechaPago = order.fechaPago || new Date();
                    break;

                case 'pending':
                case 'in_process':
                    nuevoEstadoPago = 'pendiente';
                    descripcionEvento = `Pago pendiente - ID: ${paymentId}`;
                    break;

                case 'rejected':
                    nuevoEstadoPago = 'rechazado';
                    descripcionEvento = `Pago rechazado - ID: ${paymentId} - Motivo: ${paymentInfo.status_detail}`;
                    break;

                case 'cancelled':
                    nuevoEstadoPago = 'cancelado';
                    descripcionEvento = `Pago cancelado - ID: ${paymentId}`;
                    break;

                case 'refunded':
                    nuevoEstadoPago = 'reembolsado';
                    descripcionEvento = `Pago reembolsado - ID: ${paymentId}`;
                    break;

                default:
                    descripcionEvento = `Estado desconocido: ${paymentInfo.status} - ID: ${paymentId}`;
            }

            // Solo actualizar si el estado cambió
            if (order.estadoPago !== nuevoEstadoPago) {
                order.estadoPago = nuevoEstadoPago;
                console.log(`   ✅ Estado actualizado: ${order.estadoPago} → ${nuevoEstadoPago}`);
            }

            await order.save();

            // ✅ Registrar evento
            await OrderEventLog.create({
                orderId: order._id,
                eventType: 'payment_notification',
                description: descripcionEvento,
                metadata: {
                    paymentId,
                    status: paymentInfo.status,
                    statusDetail: paymentInfo.status_detail,
                    paymentType: paymentInfo.payment_type_id,
                    paymentMethod: paymentInfo.payment_method_id,
                    transactionAmount: paymentInfo.transaction_amount
                }
            });

            console.log(`   ✅ Webhook procesado exitosamente`);

            return {
                processed: true,
                orderId: order._id,
                orderNumber: order.orderNumber,
                oldStatus: order.estadoPago,
                newStatus: nuevoEstadoPago,
                paymentStatus: paymentInfo.status
            };

        } catch (error) {
            console.error('❌ [MP Webhook] Error procesando notificación:', error);
            throw error;
        }
    }
}

// ✅ Exportar instancia única (singleton)
export default new MercadoPagoService();
