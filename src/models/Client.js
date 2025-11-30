import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    whatsapp: {
        type: String,
        required: true,
        trim: true,
        // Acepta formatos: +54911234567, 1112345567, etc
        match: /^(\+?\d{1,3})?[\d\s\-()]{9,}$/
    },
    
    // Referencias a órdenes
    historialPedidos: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],
    
    // Estadísticas
    totalGastado: {
        type: Number,
        default: 0
    },
    totalPedidos: {
        type: Number,
        default: 0
    },
    
    // Notas internas
    notasInternas: {
        type: String,
        default: ''
    },
    
    // Datos de auditoría
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    ultimaActividad: {
        type: Date,
        default: Date.now
    },
    
    // Control de estado
    activo: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Actualizar ultimaActividad antes de guardar
clientSchema.pre('save', function(next) {
    this.ultimaActividad = Date.now();
    next();
});

export default mongoose.model('Client', clientSchema);
