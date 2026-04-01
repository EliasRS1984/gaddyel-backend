/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas de autenticación del panel de administración.
 * Gestiona registro, login, renovación de sesión y logout de admins.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cada ruta tiene validación de datos antes de llegar al controlador.
 * 2. El login tiene límite de intentos (loginLimiter) para evitar ataques de fuerza bruta.
 * 3. El refresh permite renovar el token de acceso sin volver a iniciar sesión.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El admin no puede registrarse? → Revisar las reglas en 'validarRegistro'
 * - ¿El login devuelve error 429? → Se superaron los intentos permitidos; esperar 15 min
 * ======================================================
 */

import express from "express";
import adminAuthController from "../controllers/adminAuthController.js";

// ✅ M8: Validación manual — reemplaza express-validator (no aprobado en directriz del proyecto).
// Esta función revisa los datos del formulario antes de llegar al controlador.
// ¿El admin no puede registrarse? Revisa las reglas en este bloque.
const validarRegistro = (req, res, next) => {
    const { usuario, password } = req.body;
    if (!usuario || typeof usuario !== 'string') {
        return res.status(400).json({ error: 'El nombre de usuario es requerido' });
    }
    const usuarioTrim = usuario.trim();
    if (usuarioTrim.length < 3 || usuarioTrim.length > 30) {
        return res.status(400).json({ error: 'El usuario debe tener entre 3 y 30 caracteres' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(usuarioTrim)) {
        return res.status(400).json({ error: 'El usuario solo puede contener letras, números y guiones bajos' });
    }
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'La contraseña es requerida' });
    }
    if (password.length < 8 || password.length > 50) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 50 caracteres' });
    }
    req.body.usuario = usuarioTrim;
    next();
};

const validarLogin = (req, res, next) => {
    const { usuario, password } = req.body;
    if (!usuario || typeof usuario !== 'string' || usuario.trim().length < 3) {
        return res.status(400).json({ error: 'Usuario inválido' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Contraseña inválida' });
    }
    req.body.usuario = usuario.trim();
    next();
};

export default function adminAuthRouter(loginLimiter) {
    const router = express.Router();

    // Registrar (temporal)
    router.post(
        "/registrar",
        validarRegistro,
        adminAuthController.register
    );

    // Login (con limiter y validación)
    router.post(
        "/login",
        validarLogin,
        loginLimiter,
        adminAuthController.login
    );

    // Refresh token
    router.post("/refresh", adminAuthController.refresh);

    // Logout
    router.post("/logout", adminAuthController.logout);

    return router;
}
