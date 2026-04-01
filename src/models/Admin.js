/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La estructura del usuario administrador en la base de datos.
 * Define qué información se guarda de cada admin: su nombre de usuario,
 * su contraseña (guardada encriptada), su rol y su email.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cuando se crea un admin, se guarda su usuario y contraseña.
 * 2. La contraseña se encripta antes de guardarse (en el controlador, no aquí).
 * 3. El campo 'rol' define si tiene permisos normales ('admin') o totales ('superadmin').
 * 4. El paso de validación al final convierte el campo viejo 'contraseña' al nuevo
 *    'password' para mantener compatibilidad con datos anteriores.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se puede loguear un admin existente? → Verificar que el campo sea 'password' y no 'contraseña'
 * - ¿El rol no bloquea acciones? → El control de rol se hace en los controladores, no aquí
 * - Documentación oficial: https://mongoosejs.com/docs/guide.html
 * ======================================================
 */

import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },

    // Estandarizado a "password"
    password: { type: String, required: true },
    
    // ✅ NUEVO: Campo rol para control de permisos
    rol: { type: String, default: 'admin', enum: ['admin', 'superadmin'] },
    
    // ✅ Email opcional para mejorar identificación
    email: { type: String, sparse: true },
    
    // Timestamp
    createdAt: { type: Date, default: Date.now }
});

// Paso de compatibilidad: si algún dato viejo usa 'contraseña' en lugar de 'password',
// lo convierte automáticamente antes de guardarlo.
adminSchema.pre("validate", function (next) {
    if (this.contraseña && !this.password) {
        this.password = this.contraseña;
        this.contraseña = undefined;
    }
    next();
});

export default mongoose.model("Admin", adminSchema);
