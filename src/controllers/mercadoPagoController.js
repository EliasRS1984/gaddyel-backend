/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de pagos con Mercado Pago.
 * Se encarga de crear los checkouts (enlaces de pago) y
 * procesar las notificaciones que MP envía cuando alguien paga.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El cliente crea una orden en el sitio web.
 * 2. El frontend llama a createCheckoutPreference para obtener el enlace de pago.
 * 3. El cliente es redirigido al sitio de Mercado Pago y completa el pago.
 * 4. Mercado Pago envía una notificación automática (webhook) a handleWebhook.
 * 5. handleWebhook llama a procesarPago, que busca el pedido y actualiza su estado.
 * 6. Si hay errores de red, procesarPagoConRetry reintenta hasta 3 veces.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El cliente no puede pagar? → Revisar createCheckoutPreference y los logs de MP
 * - ¿El pedido no pasa a "aprobado" después del pago? → Revisar procesarPago
 * - ¿Aparece error de firma en los logs? → El middleware verifyMercadoPagoSignature lo maneja
 * - ¿El estado de un pago es incorrecto? → Revisar getPaymentStatus
 * - Documentación oficial: https://www.mercadopago.com.ar/developers/es/reference
 * ======================================================
 */

import axios from 'axios';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import MercadoPagoService from '../services/MercadoPagoService.js';
import logger from '../utils/logger.js';

// URL base de la API de Mercado Pago y token de acceso al servidor
const MP_API_URL = 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;


// ======== CREAR PREFERENCIA DE PAGO ========
// Cuando el cliente llega al checkout, esta función genera el enlace de pago en Mercado Pago.
// Si el pedido ya tiene un enlace vigente, lo reutiliza para evitar cobros dobles.
// ¿El botón de pago no aparece? → Verificar que MERCADO_PAGO_ACCESS_TOKEN esté configurado.

export const createCheckoutPreference = async (req, res) => {
    try {
        const { ordenId } = req.body;

        if (!ordenId) {
            logger.warn('MP: ordenId no recibido en solicitud de checkout', { ip: req.ip });
            return res.status(400).json({ error: 'ordenId requerido' });
        }

        const orden = await Order.findById(ordenId);
        if (!orden) {
            logger.warn('MP: Pedido no encontrado al crear preferencia', { ordenId });
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // ======== VERIFICACIÓN DE PERTENENCIA ========
        // Solo el cliente dueño de la orden (o un admin) puede crear/reutilizar
        // su preferencia de pago. Sin esto, cualquier cliente autenticado podría
        // iniciar el pago de la orden de otro cliente conociendo su ID.
        const esAdmin = req.user?.rol === 'admin';
        const esPropietario = orden.clienteId?.toString() === req.user?.id;
        if (!esAdmin && !esPropietario) {
            logger.security('Intento de acceso a preferencia de pedido ajeno', { ordenId, userId: req.user?.id });
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Si ya existe un enlace de pago para este pedido, reutilizarlo.
        // Esto evita cobros dobles cuando el cliente hace clic varias veces seguidas.
        if (orden.payment?.mercadoPago?.preferenceId && orden.payment?.mercadoPago?.initPoint) {
            logger.info('MP: Reutilizando preferencia existente', {
                ordenId:     orden._id,
                orderNumber: orden.orderNumber,
                preferenceId:orden.payment.mercadoPago.preferenceId
            });
            return res.json({
                ok:              true,
                checkoutUrl:     orden.payment.mercadoPago.initPoint,
                sandboxCheckoutUrl: orden.payment.mercadoPago.sandboxInitPoint,
                preferenceId:    orden.payment.mercadoPago.preferenceId,
                reused:          true
            });
        }

        // Crear nuevo enlace de pago en Mercado Pago
        const { preferenceId, initPoint, sandboxInitPoint } = await MercadoPagoService.createPreference(orden);

        logger.info('MP: Preferencia creada exitosamente', {
            ordenId:     orden._id,
            orderNumber: orden.orderNumber,
            preferenceId,
            itemsCount:  orden.items.length
        });

        res.json({
            ok:              true,
            checkoutUrl:     initPoint,
            sandboxCheckoutUrl: sandboxInitPoint,
            preferenceId
        });

    } catch (err) {
        logger.error('MP: Error al crear preferencia de pago', {
            message: err.message,
            ordenId: req.body.ordenId
        });
        res.status(500).json({ error: 'Error creando checkout' });
    }
};


// ======== WEBHOOK DE MERCADO PAGO ========
// Mercado Pago llama a esta función automáticamente cuando alguien realiza un pago.
// La firma HMAC ya fue validada por el middleware ANTES de llegar aquí.
// IMPORTANTE: Se responde 200 de inmediato y el procesamiento continúa en segundo plano,
// porque Mercado Pago exige respuesta en menos de 5 segundos o reintenta el envío.
// ¿El pedido no se actualiza después del pago? → Revisar los logs con el ID del webhook.

export const handleWebhook = async (req, res) => {
    // Responder inmediatamente para cumplir el timeout de Mercado Pago (< 5 segundos)
    res.status(200).json({ status: 'received' });

    const type      = req.query.type;
    const paymentId = req.query['data.id'];
    const webhookId = req.query.id;
    const liveMode  = req.query.live_mode === 'true';

    logger.info('MP: Webhook recibido', { type, paymentId, webhookId, liveMode, ip: req.ip });

    // Procesar en segundo plano para no bloquear la respuesta HTTP ya enviada
    (async () => {
        try {
            if (type === 'payment' && paymentId) {
                await procesarPagoConRetry(paymentId);
            } else if (type === 'merchant_order' && paymentId) {
                await procesarMerchantOrder(paymentId);
            } else {
                logger.warn('MP: Tipo de webhook no reconocido o sin paymentId', {
                    type,
                    paymentId,
                    webhookId
                });
            }
        } catch (err) {
            logger.error('MP: Error al procesar webhook en segundo plano', {
                message: err.message,
                webhookId,
                type
            });
        }
    })();
};


// ======== PROCESAR NOTIFICACIÓN DE PAGO ========
// Cuando MP avisa que alguien pagó, esta función busca el pedido en la base de datos
// y actualiza su estado (aprobado, rechazado, etc.).
// ¿El estado del pedido no cambia? → Verificar que external_reference coincida con el _id del pedido.

async function procesarPago(paymentId) {
    try {
        // Consultar a Mercado Pago los detalles del pago
        const response = await axios.get(
            `${MP_API_URL}/payments/${paymentId}`,
            {
                headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
                timeout: 8000
            }
        );

        const payment = response.data;
        const ordenId = payment.external_reference;

        const orden = await Order.findById(ordenId);
        if (!orden) {
            logger.error('MP: Pedido no encontrado al procesar pago', { paymentId, ordenId });
            return;
        }

        // Si el pago ya está aprobado en nuestra base de datos, ignorar para evitar duplicados
        if (orden.estadoPago === 'approved' && payment.status === 'approved') {
            logger.warn('MP: Pago duplicado detectado, ignorando', {
                orderNumber: orden.orderNumber,
                paymentId
            });
            return;
        }

        // Traducir el estado de Mercado Pago al estado interno del sistema
        const statusMapping = {
            'approved':  'approved',
            'pending':   'pending',
            'rejected':  'rejected',
            'cancelled': 'cancelled'
        };

        orden.estadoPago           = statusMapping[payment.status] || 'pending';
        orden.mercadoPagoPaymentId = paymentId;

        // Guardar datos de la transacción para mostrar en el panel de admin.
        // NOTA: payerEmail/payerId son datos del comprador necesarios para soporte.
        // No se loguean en archivos de log del servidor (OWASP: no exponer datos personales en logs).
        orden.payment = orden.payment || {};
        const grossAmount      = Number(payment.transaction_amount) || 0;
        const netReceived      = Number(payment.transaction_details?.net_received_amount) || null;
        const feeAmount        = netReceived !== null ? Math.max(0, grossAmount - netReceived) : null;
        const percentEffective = feeAmount !== null && grossAmount > 0 ? feeAmount / grossAmount : null;

        orden.payment.mercadoPago = {
            preferenceId:      payment.preference_id || undefined,
            paymentId:         payment.id,
            status:            payment.status,
            statusDetail:      payment.status_detail,
            paymentType:       payment.payment_type,
            paymentMethod:     payment.payment_method?.id || 'unknown',
            transactionAmount: grossAmount,
            netAmount:         netReceived ?? undefined,
            installments:      payment.installments || 1,
            createdAt:         new Date(payment.date_created),
            lastUpdate:        new Date(payment.last_modified),
            approvedAt:        payment.date_approved ? new Date(payment.date_approved) : null,
            payerEmail:        payment.payer?.email,
            payerId:           payment.payer?.id,
            authorizationCode: payment.authorization_code,
            merchantAccountId: payment.merchant_account_id,
            fee: {
                amount:           feeAmount ?? 0,
                percentEffective: percentEffective ?? 0
            }
        };
        orden.payment.method = 'mercadopago';

        // Mantener detalles anteriores por compatibilidad con código existente
        orden.detallesPago = {
            cardLastFour: payment.card?.last_four_digits,
            cardBrand:    payment.card?.issuer?.name,
            installments: payment.installments,
            paymentType:  payment.payment_type
        };

        // Si el pago fue aprobado, activar el pedido y registrar en el historial del cliente
        if (payment.status === 'approved') {
            orden.estadoPedido = 'en_produccion';
            orden.fechaPago    = new Date();

            const cliente = await Client.findById(orden.clienteId);
            if (cliente) {
                cliente.totalGastado += orden.total;
                cliente.totalPedidos += 1;
                if (!cliente.historialPedidos.includes(orden._id)) {
                    cliente.historialPedidos.push(orden._id);
                }
                await cliente.save();
            }

            orden.historialEstados.push({
                estado: 'en_produccion',
                nota:   'Pago aprobado por Mercado Pago'
            });

            logger.info('MP: Pago aprobado', {
                orderNumber: orden.orderNumber,
                paymentId
            });

        } else if (payment.status === 'rejected') {
            orden.motivoRechazo = payment.status_detail || 'Rechazado por el sistema de pagos';
            logger.warn('MP: Pago rechazado', {
                orderNumber:  orden.orderNumber,
                paymentId,
                statusDetail: payment.status_detail
            });
        }

        await orden.save();

        logger.info('MP: Estado del pedido actualizado', {
            ordenId:    orden._id,
            estadoPago: orden.estadoPago
        });

    } catch (err) {
        logger.error('MP: Error al procesar pago', { message: err.message, paymentId });
        // Propagar para que procesarPagoConRetry pueda reintentar
        throw err;
    }
}


// ======== PROCESAR NOTIFICACIÓN TIPO MERCHANT ORDER ========
// Algunas notificaciones de MP llegan como "merchant_order" en vez de "payment".
// Esta función maneja ese caso verificando el último pago registrado en la orden.

async function procesarMerchantOrder(merchantOrderId) {
    try {
        const response = await axios.get(
            `${MP_API_URL}/merchant_orders/${merchantOrderId}`,
            { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );

        const merchantOrder = response.data;
        const ordenId       = merchantOrder.external_reference;

        const orden = await Order.findById(ordenId);
        if (!orden) {
            logger.warn('MP: Pedido no encontrado al procesar merchant order', {
                merchantOrderId,
                ordenId
            });
            return;
        }

        if (merchantOrder.payments?.length > 0) {
            const pago = merchantOrder.payments[merchantOrder.payments.length - 1];

            if (pago.status === 'approved') {
                orden.estadoPago           = 'approved';
                orden.estadoPedido         = 'en_produccion';
                orden.fechaPago            = new Date();
                orden.mercadoPagoPaymentId = pago.id;
            }

            await orden.save();
            logger.info('MP: Merchant order procesada', {
                merchantOrderId,
                ordenId,
                status: pago?.status
            });
        }

    } catch (err) {
        logger.error('MP: Error al procesar merchant order', {
            message: err.message,
            merchantOrderId
        });
    }
}


// ======== CONSULTAR ESTADO DE UN PAGO ========
// El frontend usa esta función para saber si un pedido fue pagado.
// ¿El estado no se actualiza en pantalla? → Verificar que ordenId sea correcto.

export const getPaymentStatus = async (req, res) => {
    try {
        const { ordenId } = req.params;

        const orden = await Order.findById(ordenId);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // ======== VERIFICACIÓN DE PERTENENCIA ========
        // Solo el cliente dueño de la orden (o un admin) puede consultar su estado de pago.
        // Sin esto, cualquier cliente autenticado podría ver el estado de pago
        // y los últimos 4 dígitos de la tarjeta de otro cliente conociendo el ID del pedido.
        const esAdmin = req.user?.rol === 'admin';
        const esPropietario = orden.clienteId?.toString() === req.user?.id;
        if (!esAdmin && !esPropietario) {
            logger.security('Intento de consultar estado de pedido ajeno', { ordenId, userId: req.user?.id });
            return res.status(403).json({ error: 'No autorizado' });
        }

        res.json({
            ok:            true,
            orderNumber:   orden.orderNumber,
            estadoPago:    orden.estadoPago,
            estadoPedido:  orden.estadoPedido,
            mercadoPagoId: orden.mercadoPagoId,
            total:         orden.total,
            fechaPago:     orden.fechaPago,
            detallesPago:  orden.detallesPago
        });

    } catch (err) {
        logger.error('MP: Error al obtener estado de pago', {
            message: err.message,
            ordenId: req.params.ordenId
        });
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
};


// ======== REINTENTOS AUTOMÁTICOS ========
// Si la consulta a Mercado Pago falla por un error temporal (red, timeout),
// esta función reintenta automáticamente hasta 3 veces con pausas crecientes.
// ¿El pago sigue sin procesarse tras 3 intentos? → Revisar conectividad del servidor a internet.

async function procesarPagoConRetry(paymentId, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`MP: Intento ${attempt}/${maxRetries} de procesar pago`, { paymentId });
            await procesarPago(paymentId);
            return; // Éxito — salir del loop
        } catch (error) {
            if (attempt === maxRetries) {
                logger.error(`MP: Fallo definitivo tras ${maxRetries} intentos`, {
                    message: error.message,
                    paymentId
                });
                throw error;
            }
            // Esperar tiempo creciente antes de reintentar: 1s → 2s → 4s
            const delay = 1000 * Math.pow(2, attempt - 1);
            logger.warn(`MP: Error en intento ${attempt}, reintentando en ${delay}ms`, {
                message: error.message,
                paymentId
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


export default {
    createCheckoutPreference,
    handleWebhook,
    getPaymentStatus
};
