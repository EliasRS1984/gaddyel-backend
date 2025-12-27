import mongoose from "mongoose";
import bcrypt from 'bcryptjs';

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
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        index: true
    },
    password: {
        type: String,
        required: false, // Opcional para clientes que solo hicieron pedidos sin registrarse
        select: false, // No incluir en queries por defecto
        minlength: 6  // ✅ Cambiar a 6 para que coincida con la validación frontend
    },
    whatsapp: {
        type: String,
        required: false,
        trim: true,
        // Acepta formatos: +54911234567, 1112345567, etc
        match: /^(\+?\d{1,3})?[\d\s\-()]{9,}$/
    },
    
    // ✅ Dirección predeterminada (nivel superior para acceso rápido)
    domicilio: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
    },
    localidad: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ''
    },
    provincia: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ''
    },
    codigoPostal: {
        type: String,
        trim: true,
        maxlength: 10,
        default: ''
    },
    
    // Direcciones de envío (array principal - sin duplicación)
    direcciones: [
        {
            domicilio: { type: String, trim: true, maxlength: 200 },
            localidad: { type: String, trim: true, maxlength: 100 },
            provincia: { type: String, trim: true, maxlength: 100 },
            codigoPostal: { type: String, trim: true, maxlength: 10 },
            predeterminada: { type: Boolean, default: false },
            etiqueta: { type: String, trim: true, maxlength: 50 } // ej: Principal, Casa, Trabajo
        }
    ],
    
    // ✅ Control de intentos de login
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    
    activo: {
        type: Boolean,
        default: true
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
    ultimoLogin: Date
}, { timestamps: true });

// ✅ Pre-save hook para hashear contraseña
clientSchema.pre('save', async function(next) {
    // Actualizar ultimaActividad
    this.ultimaActividad = Date.now();
    
    // Solo hashear si la contraseña fue modificada
    if (!this.isModified('password')) return next();

    try {
        // Saltar si no hay contraseña (cliente invitado)
        if (!this.password) return next();

        const salt = await bcrypt.genSalt(12); // ✅ 12 rounds
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// ✅ Método para comparar contraseña
clientSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
};

// ✅ Verificar si cuenta está bloqueada
clientSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

// ✅ Incrementar intentos fallidos
clientSchema.methods.incLoginAttempts = async function() {
    // Reset después de 2 horas
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Bloquear después de 5 intentos
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) };
    }

    return this.updateOne(updates);
};

// ✅ Reset de intentos fallidos
clientSchema.methods.resetLoginAttempts = async function() {
    return this.updateOne({
        $set: { loginAttempts: 0, ultimoLogin: new Date() },
        $unset: { lockUntil: 1 }
    });
};

// ✅ Índice compuesto para búsquedas comunes
clientSchema.index({ email: 1, activo: 1 });
clientSchema.index({ fechaCreacion: -1 }); // Para reportes

export default mongoose.model('Client', clientSchema);
