import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema({
    // Tipo de evento
    type: {
        type: String,
        enum: ['payment', 'merchantOrder'],
        required: true
    },
    
    // ID externo del evento
    externalId: {
        type: String,
        sparse: true
    },
    
    // Payload completo recibido
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    
    // Respuesta del procesamiento
    procesadoCorrectamente: {
        type: Boolean,
        default: false
    },
    
    // Resultado del procesamiento
    resultado: {
        tipo: String, // 'success' | 'error'
        mensaje: String,
        ordenId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            sparse: true
        }
    },
    
    // Intentos de procesamiento
    intentos: {
        type: Number,
        default: 1
    },
    
    // Fecha de recepción
    fechaRecepcion: {
        type: Date,
        default: Date.now
    },
    
    // Fecha de procesamiento
    fechaProcesamiento: {
        type: Date,
        default: null
    },
    
    // IP del cliente
    ipCliente: {
        type: String
    }
}, { timestamps: true });

// Índices para búsquedas
webhookLogSchema.index({ type: 1, fechaRecepcion: -1 });
// externalId ya tiene sparse: true
webhookLogSchema.index({ procesadoCorrectamente: 1 });

export default mongoose.model('WebhookLog', webhookLogSchema);
