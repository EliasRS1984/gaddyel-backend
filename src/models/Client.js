/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La estructura de los clientes en la base de datos.
 * Guarda todos los datos de cada persona que hace un pedido:
 * datos de contacto, dirección de envío, historial de compras
 * y control de seguridad para el login.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cuando un cliente hace su primera compra, se crea un registro aquí.
 * 2. La contraseña (si la tiene) se encripta automáticamente antes de guardarse.
 * 3. Después de 5 intentos de login fallidos, la cuenta se bloquea 2 horas.
 * 4. El historial de pedidos guarda referencias a las órdenes del cliente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se puede loguear un cliente? → Verificar 'loginAttempts' y 'lockUntil'
 * - ¿La dirección no se guarda? → Los campos son 'domicilio', 'localidad', 'provincia', 'codigoPostal'
 * - ¿La contraseña no funciona? → Revisar el método 'comparePassword'
 * - Documentación oficial: https://mongoosejs.com/docs/guide.html
 * ======================================================
 */

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
    
    // Dirección de envío — se completa cuando el cliente realiza su primera compra
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
    
    // Control de intentos de login fallidos
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

// Antes de guardar: encripta la contraseña si fue modificada
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

// Compara una contraseña ingresada con la contraseña encriptada guardada.
// Se usa al hacer login para verificar que sea correcta.
clientSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
};

// Devuelve true si la cuenta está bloqueada por demasiados intentos fallidos
clientSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

// Registra un intento de login fallido. Después de 5 intentos, bloquea la cuenta por 2 horas.
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

// Limpia el contador de intentos fallidos cuando el login fue exitoso
clientSchema.methods.resetLoginAttempts = async function() {
    return this.updateOne({
        $set: { loginAttempts: 0, ultimoLogin: new Date() },
        $unset: { lockUntil: 1 }
    });
};

// Índices para acelerar búsquedas frecuentes
clientSchema.index({ email: 1, activo: 1 });
clientSchema.index({ fechaCreacion: -1 }); // Para reportes de nuevos clientes

export default mongoose.model('Client', clientSchema);
