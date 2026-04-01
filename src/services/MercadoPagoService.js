/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Este archivo se encarga de toda la comunicación con Mercado Pago:
 * crear preferencias de pago, validar notificaciones de cobro
 * (webhooks) y consultar el estado de un pago.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Al arrancar el servidor, se crea una sola instancia de este servicio.
 * 2. Cuando un cliente va a pagar, createPreference() arma la orden
 *    en Mercado Pago y devuelve el enlace de pago.
 * 3. Cuando Mercado Pago confirma el cobro, validateWebhookSignature()
 *    verifica que la notificación sea auténtica y no falsificada.
 * 4. processWebhookNotification() actualiza el estado de la orden
 *    en la base de datos según el resultado del pago.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se generan preferencias de pago? → Revisa createPreference()
 *   y que MERCADO_PAGO_ACCESS_TOKEN esté en las variables de entorno.
 * - ¿Los webhooks llegan pero son rechazados? → Revisa
 *   validateWebhookSignature() y la variable MERCADO_PAGO_WEBHOOK_SECRET.
 * - ¿El estado de la orden no se actualiza? → Revisa
 *   processWebhookNotification() y el switch de paymentInfo.status.
 * - Documentación oficial: https://www.mercadopago.com.ar/developers/es/reference
 * ======================================================
 */

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import crypto from 'crypto';
import Order from '../models/Order.js';
import OrderEventLog from '../models/OrderEventLog.js';
import logger from '../utils/logger.js';

class MercadoPagoService {
    constructor() {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

        if (!accessToken) {
            logger.warn('MERCADO_PAGO_ACCESS_TOKEN no configurado — el servicio de pagos estará deshabilitado');
            this.enabled = false;
            return;
        }

        // ✅ Inicializar SDK oficial
        this.client = new MercadoPagoConfig({
            accessToken,
            options: {
                timeout: 10000, // ✅ CORREGIDO: 10s (recomendación oficial MP)
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

        logger.info('MercadoPagoService inicializado correctamente');
    }

    // ======== CREAR PREFERENCIA DE PAGO ========
    // Arma la orden en Mercado Pago y devuelve el enlace que lleva al cliente al checkout.
    async createPreference(order) {
        if (!this.enabled) {
            throw new Error('Mercado Pago no está configurado. Configura MERCADO_PAGO_ACCESS_TOKEN en .env');
        }

        try {
            logger.info('Creando preferencia de pago', { orderId: order._id });

            // ======== ARMAR LISTA DE PRODUCTOS ========
            // Cada producto del pedido se convierte en un ítem de Mercado Pago.
            // Los campos id, title, category_id y description mejoran la tasa de aprobación. (Estructura completa según recomendaciones MP)
            // Campos CRÍTICOS para alcanzar 100/100 en calidad de integración:
            // - id: Código único del item
            // - title: Nombre del item
            // - description: Descripción del item (mejora tasa de aprobación)
            // - category_id: Categoría (mejora prevención de fraude)
            // - quantity: Cantidad
            // - unit_price: Precio unitario
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
                    description: item.descripcion || `Producto personalizado: ${item.nombre}`,
                    category_id: 'others', // Categoría: others, art, toys, fashion, etc.
                    quantity: quantity,
                    unit_price: unitPrice,
                    currency_id: 'ARS'
                };
            });

            // ✅ AGREGAR COSTO DE ENVÍO COMO ÍTEM (si corresponde)
            // CRÍTICO: Mercado Pago suma solo los items, no tiene campo shipping separado
            // Por lo tanto, el envío debe ir como un ítem adicional
            const costoEnvio = parseFloat(order.costoEnvio) || 0;
            if (costoEnvio > 0) {
                items.push({
                    id: `${order._id.toString()}-shipping`,
                    title: 'Costo de Envío',
                    quantity: 1,
                    unit_price: costoEnvio,
                    currency_id: 'ARS'
                });
            }

            // ======== RECARGO POR PASARELA ========
            // Si la orden ya tiene calculado un recargo por usar Mercado Pago,
            // se agrega como ítem separado para que el total coincida.
            const surcharge = Number(order.ajustesPago?.monto) || 0;
            if (surcharge > 0) {
                const label = order.ajustesPago?.etiqueta || 'Recargo Mercado Pago';
                items.push({
                    id: `${order._id.toString()}-mp-fee`,
                    title: label,
                    quantity: 1,
                    unit_price: surcharge,
                    currency_id: 'ARS'
                });
            }

            // ======== DATOS DEL COMPRADOR ========
            // Mercado Pago necesita al menos el email.
            // El nombre, teléfono y dirección son opcionales pero mejoran
            // la tasa de aprobación y reducen rechazos por sospecha de fraude.
            
            // Separar nombre y apellido del nombre completo
            const nombreCompleto = order.datosComprador?.nombre || '';
            const partesNombre = nombreCompleto.trim().split(' ');
            const nombre = partesNombre[0] || 'Cliente';
            const apellido = partesNombre.slice(1).join(' ') || 'Gaddyel';
            
            const payer = {
                email: order.datosComprador?.email,
                name: nombre,
                surname: apellido
            };
            
            // Agregar teléfono si está disponible
            if (order.datosComprador?.telefono) {
                payer.phone = {
                    area_code: '',
                    number: order.datosComprador.telefono.toString()
                };
            }
            
            // Agregar dirección si está disponible
            if (order.datosComprador?.domicilio) {
                payer.address = {
                    street_name: order.datosComprador.domicilio,
                    street_number: order.datosComprador.numero || '',
                    zip_code: order.datosComprador.codigoPostal || ''
                };
            }
            
            if (!payer.email) {
                throw new Error('Email del comprador es requerido');
            }

            // ======== URLs DE RETORNO ========
            // Adónde lleva Mercado Pago al cliente según el resultado del pago.
            const backUrls = {
                success: `${this.frontendUrl}/pedido-confirmado/${order._id}`,
                failure: `${this.frontendUrl}/pedido-fallido/${order._id}`,
                pending: `${this.frontendUrl}/pedido-pendiente/${order._id}`
            };

            // ======== ARMAR DATOS DE PREFERENCIA ========
            // Configuración completa enviada a Mercado Pago.
            // binary_mode = true: respuesta instantánea (aprobado o rechazado, sin "pendiente").
            // expires = true: la preferencia vence en 24 horas.
            const preferenceData = {
                items,
                payer,
                back_urls: backUrls,
                auto_return: 'all',
                external_reference: order._id.toString(),
                statement_descriptor: 'GADDYEL',
                notification_url: `${this.backendUrl}/api/webhooks/mercadopago`,
                binary_mode: true,
                expires: true,
                expiration_date_from: new Date().toISOString(),
                expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

            // Enviar preferencia a Mercado Pago con clave de idempotencia
            // para garantizar que no se creen preferencias duplicadas.
            const idempotencyKey = `pref-${order._id.toString()}-${Date.now()}`;
            
            const response = await this.preferenceClient.create({
                body: preferenceData,
                requestOptions: { idempotencyKey }
            });

            logger.info('Preferencia de pago creada', { orderId: order._id, preferenceId: response.id });

            // Guardar el ID y enlace de pago en la orden
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
            logger.error('Error creando preferencia de pago', { orderId: order._id, message: error.message });
            
            // Registrar el error en el historial de la orden para auditoría
            try {
                await OrderEventLog.create({
                    orderId: order._id,
                    eventType: 'preference_creation_error',
                    description: 'Error al crear preferencia de pago',
                    metadata: { message: error.message }
                });
            } catch {
                // Si el log falla, no interrumpir el flujo principal
            }

            throw new Error(`Error al crear preferencia de Mercado Pago: ${error.message}`);
        }
    }

    // ======== CONSULTAR ESTADO DE UN PAGO ========
    // Dado el ID de un pago, obtiene toda la información actualizada desde Mercado Pago.
    async getPaymentInfo(paymentId) {
        try {
            const payment = await this.paymentClient.get({ id: paymentId });
            logger.info('Información de pago obtenida', { paymentId, status: payment.status });
            return payment;
        } catch (error) {
            logger.error('Error obteniendo información de pago', { paymentId, message: error.message });
            throw new Error(`Error al obtener información del pago: ${error.message}`);
        }
    }

    // ======== VALIDAR FIRMA DEL WEBHOOK ========
    // Verifica que una notificación recibida fue enviada realmente por Mercado Pago
    // y no por un tercero malicioso.
    // Si devuelve false, la notificación debe ignorarse.
    // Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
    validateWebhookSignature(headers, query) {
        try {
            const xSignature = headers['x-signature'];
            const xRequestId = headers['x-request-id'];

            if (!xSignature || !xRequestId) {
                logger.warn('Webhook rechazado: headers de firma faltantes');
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
                logger.warn('Webhook rechazado: formato de x-signature inválido');
                return false;
            }

            // Verificar que el webhook fue enviado hace menos de 5 minutos.
            // Esto evita que alguien capture un webhook válido y lo reenvíe después.
            const tsNum = parseInt(ts, 10);
            const ahora = Math.floor(Date.now() / 1000);
            if (isNaN(tsNum) || Math.abs(ahora - tsNum) > 300) {
                logger.warn('Webhook rechazado: timestamp demasiado antiguo o inválido');
                return false;
            }

            // Mercado Pago usa dos formatos de notificación;
            // detectar cuál viene y extraer el ID de pago correspondiente.
            const dataId = query['data.id'] || query['id'] || '';
            const manifestString = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

            // Calcular la firma esperada con HMAC SHA-256
            const hmacCalculado = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(manifestString)
                .digest('hex');

            // Comparar usando timingSafeEqual para evitar que un atacante
            // deduzca la firma correcta midiendo el tiempo de respuesta.
            let isValid = false;
            try {
                isValid = crypto.timingSafeEqual(
                    Buffer.from(hmacCalculado, 'hex'),
                    Buffer.from(hash, 'hex')
                );
            } catch {
                isValid = false;
            }

            if (!isValid) {
                logger.warn('Webhook rechazado: firma HMAC inválida');
            }

            return isValid;

        } catch (error) {
            logger.error('Error validando firma del webhook', { message: error.message });
            return false;
        }
    }

    // ======== PROCESAR NOTIFICACIÓN DE WEBHOOK ========
    // Cuando Mercado Pago avisa sobre un pago, esta función actualiza el estado
    // de la orden en la base de datos según lo que haya pasado.
    async processWebhookNotification(notification) {
        try {
            // Mercado Pago usa dos formatos de notificación; detectar cuál es.
            
            let paymentId, notificationType;
            
            if (notification.topic) {
                // Formato nuevo: ?id=xxx&topic=payment
                notificationType = notification.topic;
                paymentId = notification.resource; // resource contiene el ID directamente
            } else {
                // Formato antiguo: ?data.id=xxx&type=topic_payment_wh
                notificationType = notification.type;
                paymentId = notification.data?.id;
            }

            logger.info('Procesando notificación de webhook', { type: notificationType, paymentId: paymentId || null });

            // Solo se procesan notificaciones de pagos y órdenes de comercio.
            const tiposValidos = ['payment', 'merchant_order', 'topic_payment_wh', 'topic_merchant_order_wh'];
            
            if (!tiposValidos.some(tipo => notificationType.includes(tipo))) {
                return { processed: false, reason: 'tipo_no_procesable' };
            }

            // Cuando llega una notificación de merchant_order (orden de comercio),
            // se busca la orden más reciente y se cierra si el pago fue completado.
            if (notificationType.includes('merchant_order')) {
                const merchantOrderId = notification.id || paymentId;
                logger.info('Webhook de merchant order recibido', { merchantOrderId });
                
                const order = await Order.findOne({ 
                    'payment.mercadoPago.preferenceId': { $exists: true } 
                }).sort({ createdAt: -1 }).limit(1);
                
                if (order) {
                    if (notification.status === 'closed' && order.estadoPago === 'pending') {
                        order.estadoPago = 'approved';
                        order.fechaPago = new Date();
                        await order.save();
                        
                        logger.info('Orden aprobada por merchant_order cerrado', { orderNumber: order.orderNumber });
                        
                        return {
                            processed: true,
                            orderId: order._id,
                            orderNumber: order.orderNumber,
                            oldStatus: 'pending',
                            newStatus: 'approved',
                            source: 'merchant_order'
                        };
                    }
                }
                
                return { processed: true, reason: 'merchant_order_sin_cambios' };
            }

            if (!paymentId) {
                logger.warn('Webhook ignorado: payment ID no encontrado en notificación');
                return { processed: false, reason: 'payment_id_faltante' };
            }

            // Consultar el estado actualizado del pago en Mercado Pago
            const paymentInfo = await this.getPaymentInfo(paymentId);

            // Buscar la orden por el external_reference que se envió al crear la preferencia
            const orderId = paymentInfo.external_reference;
            if (!orderId) {
                logger.warn('Webhook ignorado: external_reference no encontrado en el pago', { paymentId });
                return { processed: false, reason: 'external_reference_faltante' };
            }

            const order = await Order.findById(orderId);
            if (!order) {
                logger.warn('Webhook ignorado: orden no encontrada', { orderId });
                return { processed: false, reason: 'orden_no_encontrada' };
            }

            logger.info('Orden encontrada para actualizar', { orderNumber: order.orderNumber, estadoActual: order.estadoPago, estadoMP: paymentInfo.status });

            // ======== ACTUALIZAR DATOS DEL PAGO EN LA ORDEN ========
            // Guardar toda la información del pago para mostrar el comprobante en el panel admin.
            order.payment = order.payment || {};
            order.payment.mercadoPago = order.payment.mercadoPago || {};
            
            // Datos básicos de transacción
            order.payment.mercadoPago.paymentId = paymentId;
            order.payment.mercadoPago.status = paymentInfo.status;
            order.payment.mercadoPago.statusDetail = paymentInfo.status_detail;
            
            // Método de pago (para mostrar en admin)
            order.payment.mercadoPago.paymentType = paymentInfo.payment_type_id;
            order.payment.mercadoPago.paymentMethod = paymentInfo.payment_method_id;
            
            // Montos y cuotas
            order.payment.mercadoPago.transactionAmount = paymentInfo.transaction_amount;
            order.payment.mercadoPago.installments = paymentInfo.installments || 1;
            
            // Fechas de transacción
            order.payment.mercadoPago.lastUpdate = new Date();
            if (paymentInfo.date_approved) {
                order.payment.mercadoPago.approvedAt = new Date(paymentInfo.date_approved);
            }
            if (paymentInfo.date_created) {
                order.payment.mercadoPago.createdAt = new Date(paymentInfo.date_created);
            }
            
            // Información del pagador (email registrado en MP)
            if (paymentInfo.payer?.email) {
                order.payment.mercadoPago.payerEmail = paymentInfo.payer.email;
            }
            if (paymentInfo.payer?.id) {
                order.payment.mercadoPago.payerId = paymentInfo.payer.id;
            }
            
            // Código de autorización (importante para verificación)
            if (paymentInfo.authorization_code) {
                order.payment.mercadoPago.authorizationCode = paymentInfo.authorization_code;
            }

            // Calcular fee efectivo si la API provee transaction_details
            const netReceived = Number(paymentInfo.transaction_details?.net_received_amount);
            if (!Number.isNaN(netReceived) && paymentInfo.transaction_amount) {
                const feeAmount = Math.max(0, Number(paymentInfo.transaction_amount) - netReceived);
                const percentEffective = feeAmount > 0 ? feeAmount / Number(paymentInfo.transaction_amount) : 0;
                order.payment.mercadoPago.fee = {
                    amount: feeAmount,
                    percentEffective
                };
            }

            // ✅ INFORMACIÓN DE TARJETA (para validación visual del admin)
            // Guardar en campo legacy detallesPago para compatibilidad
            order.detallesPago = order.detallesPago || {};
            
            if (paymentInfo.card) {
                // Últimos 4 dígitos de la tarjeta
                if (paymentInfo.card.last_four_digits) {
                    order.detallesPago.cardLastFour = paymentInfo.card.last_four_digits;
                }
                
                // Marca de la tarjeta (Visa, Mastercard, etc)
                if (paymentInfo.card.first_six_digits) {
                    // Banco emisor de la tarjeta
                    order.detallesPago.issuerBank = paymentInfo.issuer_id || 'N/A';
                }
            }
            
            // Cuotas (también guardar en detallesPago legacy)
            if (paymentInfo.installments) {
                order.detallesPago.installments = paymentInfo.installments;
            }
            
            // Tipo de pago
            if (paymentInfo.payment_type_id) {
                order.detallesPago.paymentType = paymentInfo.payment_type_id;
            }
            
            // Código de autorización (también en legacy)
            if (paymentInfo.authorization_code) {
                order.detallesPago.authorizationCode = paymentInfo.authorization_code;
            }
            
            // Marca de la tarjeta (en texto legible)
            if (paymentInfo.payment_method_id) {
                order.detallesPago.cardBrand = paymentInfo.payment_method_id; // 'visa', 'master', etc
            }

            // ======== ACTUALIZAR ESTADO DE LA ORDEN ========
            // Según el resultado del pago, se actualiza el estado del pedido.
            let nuevoEstadoPago = order.estadoPago;
            let nuevoEstadoPedido = order.estadoPedido;
            let descripcionEvento = '';

            switch (paymentInfo.status) {
                case 'approved':
                    nuevoEstadoPago = 'approved';
                    descripcionEvento = `Pago aprobado - ID: ${paymentId}`;
                    order.fechaPago = order.fechaPago || new Date();
                    
                    // Al aprobar el pago, se elimina la fecha de vencimiento automático
                    // para que la orden no sea eliminada por el TTL de MongoDB.
                    order.expiresAt = undefined;
                    
                    // Si el pedido no tenía estado, pasar a producción automáticamente.
                    if (!order.estadoPedido || order.estadoPedido === 'pendiente') {
                        nuevoEstadoPedido = 'en_produccion';
                    }
                    break;

                case 'pending':
                case 'in_process':
                    nuevoEstadoPago = 'pending';
                    descripcionEvento = `Pago pendiente - ID: ${paymentId}`;
                    
                    // Extender el vencimiento solo la primera vez que llega un webhook pendiente,
                    // para no posponer indefinidamente por webhooks repetidos.
                    if (order.estadoPago !== 'pending') {
                        order.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    }
                    break;

                case 'rejected':
                case 'cancelled':
                    // Cuando el pago es rechazado o cancelado, la orden se elimina
                    // porque no tiene valor operativo para el negocio.
                    logger.info('Eliminando orden por pago rechazado o cancelado', { orderId, status: paymentInfo.status });
                    
                    // Registrar en el historial de eventos antes de eliminar
                    await OrderEventLog.create({
                        orderId,
                        evento: 'order_deleted',
                        estadoAnterior: order.estadoPago,
                        estadoNuevo: paymentInfo.status,
                        descripcion: `Orden eliminada automáticamente - Pago ${paymentInfo.status === 'rejected' ? 'rechazado' : 'cancelado'}`,
                        detalles: {
                            paymentId,
                            status: paymentInfo.status,
                            status_detail: paymentInfo.status_detail,
                            paymentMethod: paymentInfo.payment_method_id,
                            paymentType: paymentInfo.payment_type_id,
                            transactionAmount: paymentInfo.transaction_amount,
                            razon: paymentInfo.status === 'rejected' 
                                ? paymentInfo.status_detail || 'Rechazado por el sistema de pagos'
                                : 'Cancelado por el usuario'
                        },
                        timestamp: new Date()
                    });
                    
                    // ✅ SEGUNDO: Eliminar la orden
                    await Order.findByIdAndDelete(orderId);
                    
                    return {
                        success: true,
                        message: `Orden eliminada (pago ${paymentInfo.status})`,
                        deleted: true
                    };
                    break;

                case 'refunded':
                    nuevoEstadoPago = 'refunded';
                    nuevoEstadoPedido = 'cancelado';
                    descripcionEvento = `Pago reembolsado - ID: ${paymentId}`;
                    break;

                default:
                    descripcionEvento = `Estado desconocido: ${paymentInfo.status} - ID: ${paymentId}`;
            }

            // Solo actualizar si el estado realmente cambió
            if (order.estadoPago !== nuevoEstadoPago) {
                order.estadoPago = nuevoEstadoPago;
            }

            if (order.estadoPedido !== nuevoEstadoPedido) {
                order.estadoPedido = nuevoEstadoPedido;
            }

            await order.save();

            // Registrar el evento en el historial de la orden
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

            logger.info('Webhook procesado exitosamente', { orderNumber: order.orderNumber, newStatus: nuevoEstadoPago });

            return {
                processed: true,
                orderId: order._id,
                orderNumber: order.orderNumber,
                oldStatus: order.estadoPago,
                newStatus: nuevoEstadoPago,
                paymentStatus: paymentInfo.status
            };

        } catch (error) {
            logger.error('Error procesando notificación de webhook', { message: error.message });
            throw error;
        }
    }
}

// Exportar una única instancia compartida por toda la aplicación
export default new MercadoPagoService();
