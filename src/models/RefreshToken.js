/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La estructura de los tokens de renovación de sesión en la base de datos.
 * Cuando un admin inicia sesión, se crea un refresh token que le permite
 * renovar su acceso sin tener que volver a escribir su contraseña.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Al hacer login, se guarda un refresh token aquí.
 * 2. El token tiene fecha de vencimiento. MongoDB lo elimina solo cuando expira
 *    (gracias al índice TTL).
 * 3. Al hacer logout, el token se elimina manualmente de esta colección.
 * 4. Si alguien intenta usar un refresh token que ya no existe aquí,
 *    el acceso es denegado.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los admins son desconectados inesperadamente? → Verificar 'expiresAt' — puede estar muy corto
 * - ¿Se acumulan tokens no eliminados? → Verificar que el índice TTL esté activo en MongoDB
 * ======================================================
 */

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ✅ SEGURIDAD: TTL index para que MongoDB elimine automáticamente los tokens expirados.
// Sin esto, los tokens viejos se acumulan en la base de datos indefinidamente.
// MongoDB revisa y limpia cada 60 segundos aproximadamente.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ✅ RENDIMIENTO: Índice para buscar tokens por administrador sin escanear toda la colección
refreshTokenSchema.index({ adminId: 1 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
