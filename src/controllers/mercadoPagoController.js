import Order from '../models/Order.js';
import Client from '../models/Client.js';
import WebhookLog from '../models/WebhookLog.js';
import axios from 'axios';

const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_API_URL = 'https://api.mercadopago.com/v1';

/**
 * Crear preferencia de Mercado Pago (checkout)
 * Frontend envía el ordenId después de crear la orden
 */
export const createCheckoutPreference = async (req, res) => {
    try {
        const { ordenId } = req.body;

        if (!ordenId) {
            return res.status(400).json({ error: 'ordenId requerido' });
        }

        // Obtener orden
        const orden = await Order.findById(ordenId);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Construir items para Mercado Pago
        const items = orden.items.map(item => ({
            title: item.nombre,
            quantity: item.cantidad,
            unit_price: item.precioUnitario,
            currency_id: 'ARS'
        }));

        // Crear preferencia
        const preference = {
            items: items,
            payer: {
                name: orden.datosComprador.nombre,
                email: orden.datosComprador.email,
                phone: {
                    area_code: '54',
                    number: orden.datosComprador.whatsapp.replace(/\D/g, '') // Solo números
                }
            },
            back_urls: {
                success: `${process.env.FRONTEND_URL}/pedido-confirmado?order_id=${ordenId}`,
                pending: `${process.env.FRONTEND_URL}/pedido-pendiente?order_id=${ordenId}`,
                failure: `${process.env.FRONTEND_URL}/pedido-fallido?order_id=${ordenId}`
            },
            notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
            external_reference: ordenId.toString(),
            auto_return: 'approved',
            binary_mode: true // Solo aprobado o rechazado
        };

        // Llamar API de Mercado Pago
        const response = await axios.post(
            `${MP_API_URL}/checkout/preferences`,
            preference,
            {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const { id, init_point } = response.data;

        // Guardar IDs en la orden
        orden.mercadoPagoId = id;
        orden.mercadoPagoCheckoutUrl = init_point;
        await orden.save();

        console.log('✅ Preferencia MP creada:', id);

        res.json({
            ok: true,
            checkoutUrl: init_point,
            preferenceId: id
        });

    } catch (err) {
        console.error('❌ Error creando preferencia MP:', err.message);
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

        // Si es payment, consultar API de Mercado Pago
        if (type === 'payment') {
            await procesarPago(data.id, webhookLog);
        } else if (type === 'merchant_order') {
            await procesarMerchantOrder(data.id, webhookLog);
        }

        await webhookLog.save();
        
        console.log('✅ Webhook procesado');
        res.status(200).json({ status: 'received' });

    } catch (err) {
        console.error('❌ Error procesando webhook:', err.message);
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
                }
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

            console.log(`✅ Pago aprobado: ${paymentId}`);
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
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        res.json({
            ok: true,
            estadoPago: orden.estadoPago,
            estadoPedido: orden.estadoPedido,
            mercadoPagoId: orden.mercadoPagoId,
            total: orden.total,
            fechaPago: orden.fechaPago
        });

    } catch (err) {
        console.error('❌ Error obteniendo estado de pago:', err.message);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
};

export default {
    createCheckoutPreference,
    handleWebhook,
    getPaymentStatus
};
