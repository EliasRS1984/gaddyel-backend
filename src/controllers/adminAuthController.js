/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de autenticación para administradores.
 * Maneja el registro, inicio de sesión, renovación de
 * sesión y cierre de sesión del panel de administración.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El admin envía usuario y contraseña al endpoint de login.
 * 2. Se verifica la contraseña contra el hash almacenado (bcrypt).
 * 3. Se genera un token de acceso (JWT, dura 15 min) y uno de refresco (httpOnly cookie).
 * 4. Cuando el token de acceso vence, el frontend llama a /refresh automáticamente.
 * 5. Al cerrar sesión, el token de refresco se elimina de la base de datos.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Login falla con credenciales correctas? → Revisar que bcrypt rounds coincidan y
 *   que JWT_SECRET tenga al menos 32 caracteres en el entorno
 * - ¿El token de refresco no funciona? → Revisar que la cookie httpOnly llega al servidor
 *   (revisar política CORS y sameSite en producción)
 * - ¿El admin no puede registrarse? → Revisar validaciones de contraseña en register
 * ======================================================
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import RefreshToken from '../models/RefreshToken.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import { JWT_CONFIG } from '../config/jwtConfig.js';

const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_EXP_DAYS || 30);

// Genera un token aleatorio seguro para el refresco de sesión (no es JWT)
function createRandomToken() {
    return crypto.randomBytes(40).toString('hex');
}

// Genera el token de acceso JWT que el frontend usa en cada petición al servidor
function signAccessToken(admin) {
    return jwt.sign(
        {
            id:      admin._id,
            usuario: admin.usuario,
            email:   admin.email,
            rol:     admin.rol || 'admin'
        },
        JWT_CONFIG.accessSecret,
        { expiresIn: JWT_CONFIG.accessExpiry }
    );
}


// ======== REGISTRO DE NUEVO ADMINISTRADOR ========
// Crea una cuenta de administrador con contraseña segura hasheada.
// ¿La contraseña no cumple los requisitos? → Revisar las validaciones de complejidad.

export const register = async (req, res) => {
    try {
        const { usuario, password } = req.body;
        if (!usuario || !password) return res.status(400).json({ error: 'usuario y password requeridos' });

        // Validar complejidad de la contraseña del admin.
        // Un admin con contraseña débil es una puerta de entrada a todos los datos del negocio.
        if (password.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }
        if (!/(?=.*[a-z])/.test(password)) {
            return res.status(400).json({ error: 'La contraseña debe contener al menos una letra minúscula' });
        }
        if (!/(?=.*[A-Z])/.test(password)) {
            return res.status(400).json({ error: 'La contraseña debe contener al menos una letra mayúscula' });
        }
        if (!/(?=.*\d)/.test(password)) {
            return res.status(400).json({ error: 'La contraseña debe contener al menos un número' });
        }

        const existing = await Admin.findOne({ usuario });
        if (existing) return res.status(400).json({ error: 'Usuario ya existe' });

        // Mínimo 12 rounds para proteger contra ataques de fuerza bruta
        const hash = await bcrypt.hash(password, 12);
        const admin = new Admin({ usuario, password: hash });
        await admin.save();
        res.json({ ok: true, admin: { id: admin._id, usuario: admin.usuario } });
    } catch (err) {
        logger.error('Auth: Error al registrar administrador', { message: err.message });
        res.status(500).json({ error: 'Error registrando admin' });
    }
};


// ======== INICIO DE SESIÓN ========
// Verifica credenciales y genera los tokens de acceso y refresco.
// ¿El login falla? → Las respuestas son genéricas a propósito (no revelan si el usuario existe).

export const login = async (req, res) => {
    try {
        const { usuario, password } = req.body;
        if (!usuario || !password) return res.status(400).json({ error: 'usuario y password requeridos' });

        const admin = await Admin.findOne({ usuario });
        if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

        const accessToken  = signAccessToken(admin);
        const refreshToken = createRandomToken();
        const expiresAt    = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

        await RefreshToken.create({ token: refreshToken, adminId: admin._id, expiresAt });

        // Cookie httpOnly: el navegador la envía automáticamente pero JavaScript no puede leerla
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   REFRESH_DAYS * 24 * 60 * 60 * 1000,
        });

        res.json({ token: accessToken, admin: { id: admin._id, usuario: admin.usuario } });
    } catch (err) {
        logger.error('Auth: Error en inicio de sesión', { message: err.message });
        res.status(500).json({ error: 'Error en login' });
    }
};


// ======== RENOVAR TOKEN DE ACCESO ========
// Cuando el JWT de 15 minutos vence, esta función emite uno nuevo usando la cookie de refresco.
// Aplica rotación de tokens: el token viejo se invalida y se crea uno nuevo.
// ¿El refresco falla? → Revisar que la cookie llegue al servidor y no haya vencido.

export const refresh = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) return res.status(401).json({ error: 'No refresh token' });

        const stored = await RefreshToken.findOne({ token });
        if (!stored) return res.status(401).json({ error: 'Refresh token inválido' });

        if (stored.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: stored._id });
            return res.status(401).json({ error: 'Refresh token expirado' });
        }

        // Rotación: eliminar el token viejo y crear uno nuevo para evitar reutilización
        await RefreshToken.deleteOne({ _id: stored._id });
        const newToken  = createRandomToken();
        const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
        await RefreshToken.create({ token: newToken, adminId: stored.adminId, expiresAt });

        res.cookie('refreshToken', newToken, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   REFRESH_DAYS * 24 * 60 * 60 * 1000,
        });

        const admin       = await Admin.findById(stored.adminId);
        const accessToken = signAccessToken(admin);
        res.json({ token: accessToken });
    } catch (err) {
        logger.error('Auth: Error al renovar sesión', { message: err.message });
        res.status(500).json({ error: 'Error en refresh' });
    }
};


// ======== CIERRE DE SESIÓN ========
// Elimina el token de refresco de la base de datos y borra la cookie del navegador.

export const logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) await RefreshToken.deleteOne({ token }).catch(() => {});
        res.clearCookie('refreshToken');
        res.json({ ok: true });
    } catch (err) {
        logger.error('Auth: Error al cerrar sesión', { message: err.message });
        res.status(500).json({ error: 'Error en logout' });
    }
};

export default { register, login, refresh, logout };
