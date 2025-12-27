import mongoose from 'mongoose';

/**
 * ✅ ORDER EVENT LOG - Auditoría de cambios en órdenes
 * Registra todos los eventos importantes relacionados con pagos y cambios de estado
 */

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

// Índices para consultas rápidas
OrderEventLogSchema.index({ orderId: 1, timestamp: -1 });
OrderEventLogSchema.index({ eventType: 1, timestamp: -1 });
OrderEventLogSchema.index({ timestamp: -1 });

export default mongoose.model('OrderEventLog', OrderEventLogSchema);
