import axios from 'axios';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import WebhookLog from '../models/WebhookLog.js';
import MercadoPagoService from '../services/MercadoPagoService.js';
import logger from '../utils/logger.js';

// Configuración de Mercado Pago (API)
const MP_API_URL = 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

/**
 * ✅ CONTROLADOR MERCADO PAGO - REFACTORIZADO 2025
 * Usa el nuevo MercadoPagoService con SDK oficial
 */

/**
 * Crear preferencia de Mercado Pago (checkout)
 * Frontend envía el ordenId después de crear la orden
 */
export const createCheckoutPreference = async (req, res) => {
    try {
        const { ordenId } = req.body;

        if (!ordenId) {
            logger.error('MP_NO_ORDER_ID: ordenId no proporcionado en request', {
                body: req.body
            });
            return res.status(400).json({ error: 'ordenId requerido' });
        }

        // Obtener orden
        const orden = await Order.findById(ordenId);
        if (!orden) {
            logger.error('MP_ORDER_NOT_FOUND', `Orden ${ordenId} no encontrada`, {
                ordenId
            });
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // ✅ Usar servicio optimizado
        const { preferenceId, initPoint, sandboxInitPoint } = await MercadoPagoService.createPreference(orden);

        // Log de auditoría
        logger.info('MP_PREFERENCE_CREATED', {
            orderId: orden._id,
            orderNumber: orden.orderNumber,
            preferenceId,
            total: orden.total,
            itemsCount: orden.items.length
        });

        console.log('✅ Preferencia MP creada:', preferenceId, `para orden ${orden.orderNumber}`);

        res.json({
            ok: true,
            checkoutUrl: initPoint,
            sandboxCheckoutUrl: sandboxInitPoint,
            preferenceId
        });

    } catch (err) {
        console.error('❌ Error creando preferencia MP:', err.message);
        logger.error('MP_PREFERENCE_ERROR', {
            message: err.message,
            ordenId: req.body.ordenId,
            stack: err.stack
        });
        res.status(500).json({ error: 'Error creando checkout' });
    }
};

/**
 * Webhook de Mercado Pago
 * Recibe notificaciones de pago
 */
export const handleWebhook = async (req, res) => {
    try {
        const { type, data, id } = req.query;

        // Log de recepción
        const webhookLog = new WebhookLog({
            type: type || 'unknown',
            externalId: id,
            payload: req.body,
            ipCliente: req.ip
        });

        // Log simple
        console.log('📨 [Webhook] Recibido:', type, 'ID:', id);

        // Si es payment, consultar API de Mercado Pago
        if (type === 'payment') {
            await procesarPago(data.id, webhookLog);
        } else if (type === 'merchant_order') {
            await procesarMerchantOrder(data.id, webhookLog);
        }

        await webhookLog.save();
        
        console.log('✅ Webhook procesado:', type, id);
        res.status(200).json({ status: 'received' });

    } catch (err) {
        console.error('❌ Error procesando webhook:', err.message);
        logger.error('WEBHOOK_PROCESSING_ERROR', {
            message: err.message,
            stack: err.stack,
            query: req.query
        });
        res.status(500).json({ error: 'Error procesando webhook' });
    }
};

/**
 * Procesar notificación de pago
 */
async function procesarPago(paymentId, webhookLog) {
    try {
        // Obtener información del pago
        const response = await axios.get(
            `${MP_API_URL}/payments/${paymentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
                },
                timeout: 8000
            }
        );

        const payment = response.data;
        const ordenId = payment.external_reference;

        // Buscar orden
        const orden = await Order.findById(ordenId);
        if (!orden) {
            webhookLog.resultado = {
                tipo: 'error',
                mensaje: 'Orden no encontrada'
            };
            logger.error('MP_WEBHOOK_ORDER_NOT_FOUND', {
                message: `Orden ${ordenId} no encontrada en webhook`,
                paymentId,
                externalReference: ordenId
            });
            return;
        }

        // Detectar pagos duplicados
        if (orden.estadoPago === 'approved' && payment.status === 'approved') {
            webhookLog.resultado = {
                tipo: 'warning',
                mensaje: 'Pago duplicado detectado, ignorando'
            };
            webhookLog.procesadoCorrectamente = true;
            console.warn('⚠️ DUPLICATE_PAYMENT_DETECTED:', {
                orderNumber: orden.orderNumber,
                paymentId,
                previousPaymentId: orden.mercadoPagoPaymentId
            });
            return;
        }

        // Actualizar estado según pago
        const statusMapping = {
            'approved': 'approved',
            'pending': 'pending',
            'rejected': 'rejected',
            'cancelled': 'cancelled'
        };

        orden.estadoPago = statusMapping[payment.status] || 'pending';
        orden.mercadoPagoPaymentId = paymentId;

        // 🔍 DEBUG: Loggear datos del pago recibidos de MP
        console.log('🔍 [Webhook] Datos del pago recibidos de Mercado Pago:');
        console.log('   Payment ID:', payment.id);
        console.log('   Status:', payment.status);
        console.log('   Payment Type:', payment.payment_type);
        console.log('   Payment Method:', payment.payment_method);
        console.log('   Transaction Amount:', payment.transaction_amount);
        console.log('   Card Info:', payment.card);
        console.log('   Payer:', payment.payer);

        // ✅ GUARDAR INFORMACIÓN COMPLETA DE TRANSACCIÓN
        // Esto se mostrará en el admin y en el cliente
        orden.payment = orden.payment || {};
        orden.payment.mercadoPago = {
            preferenceId: payment.preference_id || undefined,
            paymentId: payment.id,
            status: payment.status,
            statusDetail: payment.status_detail,
            paymentType: payment.payment_type, // 'account_money', 'ticket', 'atm', 'credit_card', etc.
            paymentMethod: payment.payment_method?.id || 'unknown', // 'visa', 'master', 'amex', etc.
            transactionAmount: payment.transaction_amount,
            netAmount: payment.net_amount,
            installments: payment.installments || 1,
            createdAt: new Date(payment.date_created),
            lastUpdate: new Date(payment.last_modified),
            approvedAt: payment.date_approved ? new Date(payment.date_approved) : null,
            payerEmail: payment.payer?.email,
            payerId: payment.payer?.id,
            authorizationCode: payment.authorization_code,
            merchantAccountId: payment.merchant_account_id
        };
        orden.payment.method = 'mercadopago';

        console.log('✅ [Webhook] Datos guardados en orden.payment.mercadoPago:', {
            paymentId: orden.payment.mercadoPago.paymentId,
            status: orden.payment.mercadoPago.status,
            paymentMethod: orden.payment.mercadoPago.paymentMethod,
            transactionAmount: orden.payment.mercadoPago.transactionAmount
        });

        // Guardar detalles adicionales (legacy - mantener por compatibilidad)
        orden.detallesPago = {
            cardLastFour: payment.card?.last_four_digits,
            cardBrand: payment.card?.issuer?.name,
            installments: payment.installments,
            paymentType: payment.payment_type
        };

        // Si pago aprobado, cambiar estado del pedido
        if (payment.status === 'approved') {
            orden.estadoPedido = 'en_produccion';
            orden.fechaPago = new Date();
            
            // Actualizar cliente
            const cliente = await Client.findById(orden.clienteId);
            if (cliente) {
                cliente.totalGastado += orden.total;
                cliente.totalPedidos += 1;
                if (!cliente.historialPedidos.includes(orden._id)) {
                    cliente.historialPedidos.push(orden._id);
                }
                await cliente.save();
            }

            // Registrar en historial
            orden.historialEstados.push({
                estado: 'en_produccion',
                nota: 'Pago aprobado por Mercado Pago'
            });

            console.log(`✅ Pago aprobado: ${paymentId} para orden ${orden.orderNumber}`);

            // Log simple
            console.log('✅ PAYMENT_APPROVED:', {
                orderNumber: orden.orderNumber,
                paymentId,
                total: orden.total,
                clienteId: cliente?._id
            });
        } else if (payment.status === 'rejected') {
            orden.motivoRechazo = payment.status_detail || 'Rechazado por el sistema de pagos';
            console.warn('⚠️ PAYMENT_REJECTED:', {
                orderNumber: orden.orderNumber,
                paymentId,
                statusDetail: payment.status_detail
            });
        }

        await orden.save();

        webhookLog.resultado = {
            tipo: 'success',
            mensaje: `Pago actualizado a: ${orden.estadoPago}`,
            ordenId: orden._id
        };
        webhookLog.procesadoCorrectamente = true;

    } catch (err) {
        webhookLog.resultado = {
            tipo: 'error',
            mensaje: err.message
        };
        console.error('❌ Error procesando pago:', err.message);
        logger.error('MP_PAYMENT_PROCESSING_ERROR', {
            message: err.message,
            paymentId,
            stack: err.stack
        });
    }
}

/**
 * Procesar merchant order
 */
async function procesarMerchantOrder(merchantOrderId, webhookLog) {
    try {
        const response = await axios.get(
            `${MP_API_URL}/merchant_orders/${merchantOrderId}`,
            {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
                }
            }
        );

        const merchantOrder = response.data;
        const ordenId = merchantOrder.external_reference;

        const orden = await Order.findById(ordenId);
        if (!orden) {
            webhookLog.resultado = {
                tipo: 'error',
                mensaje: 'Orden no encontrada'
            };
            return;
        }

        // Verificar pagos
        if (merchantOrder.payments && merchantOrder.payments.length > 0) {
            const payments = merchantOrder.payments;
            const pago = payments[payments.length - 1]; // Último pago

            if (pago.status === 'approved') {
                orden.estadoPago = 'approved';
                orden.estadoPedido = 'en_produccion';
                orden.fechaPago = new Date();
                orden.mercadoPagoPaymentId = pago.id;
            }

            await orden.save();
        }

        webhookLog.resultado = {
            tipo: 'success',
            mensaje: 'Merchant Order procesada',
            ordenId
        };
        webhookLog.procesadoCorrectamente = true;

    } catch (err) {
        webhookLog.resultado = {
            tipo: 'error',
            mensaje: err.message
        };
        console.error('❌ Error procesando merchant order:', err.message);
    }
}

/**
 * Obtener estado de un pago
 */
export const getPaymentStatus = async (req, res) => {
    try {
        const { ordenId } = req.params;

        const orden = await Order.findById(ordenId);
        if (!orden) {
            logger.error('MP_STATUS_ORDER_NOT_FOUND', {
                message: `Orden ${ordenId} no encontrada`,
                ordenId
            });
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json({
            ok: true,
            orderNumber: orden.orderNumber,
            estadoPago: orden.estadoPago,
            estadoPedido: orden.estadoPedido,
            mercadoPagoId: orden.mercadoPagoId,
            total: orden.total,
            fechaPago: orden.fechaPago,
            detallesPago: orden.detallesPago
        });

    } catch (err) {
        console.error('❌ Error obteniendo estado de pago:', err.message);
        logger.error('MP_STATUS_ERROR', {
            message: err.message,
            ordenId: req.params.ordenId,
            stack: err.stack
        });
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
};

export default {
    createCheckoutPreference,
    handleWebhook,
    getPaymentStatus
};
