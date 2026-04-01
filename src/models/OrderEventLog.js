/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * El registro histórico de eventos de cada pedido.
 * Cada vez que algo importante ocurre en un pedido
 * (pago aprobado, webhook recibido, cambio de estado),
 * se guarda un registro aquí para poder auditar qué pasó y cuándo.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cualquier parte del sistema puede crear un evento con 'OrderEventLog.create(...)'.
 * 2. Cada evento tiene un tipo (pago aprobado, error, etc.) y una descripción.
 * 3. El campo 'metadata' permite guardar información variable según el tipo de evento.
 * 4. Estos registros son de solo lectura — nunca se modifican, solo se crean.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No aparecen eventos de un pedido? → Verificar que se esté guardando correctamente en el servicio
 * - ¿Los eventos llegan desordenados? → Ordenar por 'timestamp' descendente al consultar
 * ======================================================
 */

import mongoose from 'mongoose';

const OrderEventLogSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false, // Puede ser null para eventos globales
        index: true
    },

    // Tipo de evento
    eventType: {
        type: String,
        required: true,
        enum: [
            'order_created',
            'preference_created',
            'preference_error',
            'payment_notification',
            'payment_approved',
            'payment_pending',
            'payment_rejected',
            'payment_cancelled',
            'payment_refunded',
            'status_changed',
            'webhook_received',
            'webhook_invalid_signature',
            'webhook_processing_error',
            'manual_action',
            'system_error'
        ]
    },

    // Descripción del evento
    description: {
        type: String,
        required: true
    },

    // Metadata adicional (flexible)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamp
    timestamp: { 
        type: Date, 
        default: Date.now, 
        index: true 
    },

    // Quién/qué generó el evento
    triggeredBy: {
        type: String,
        enum: ['webhook', 'admin', 'system', 'user'],
        default: 'system'
    },

    // ID del admin si fue acción manual
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false
    },

    // Información de contexto
    context: {
        ipAddress: String,
        userAgent: String,
        requestId: String
    }
}, { 
    timestamps: true 
});

// Índices para consultar el historial de un pedido rápidamente
OrderEventLogSchema.index({ orderId: 1, timestamp: -1 });
OrderEventLogSchema.index({ eventType: 1, timestamp: -1 });
OrderEventLogSchema.index({ timestamp: -1 });

export default mongoose.model('OrderEventLog', OrderEventLogSchema);
