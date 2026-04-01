/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Verificador de identidad del administrador.
 * Antes de permitir acceso a cualquier ruta protegida,
 * esta función comprueba que el usuario haya iniciado sesión
 * con un token válido.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lee el token del encabezado "Authorization: Bearer <token>".
 * 2. Si no hay token → responde 403 (acceso denegado).
 * 3. Si el token es inválido o expiró → responde 401 (no autorizado).
 * 4. Si el token es válido → adjunta los datos del usuario al request
 *    y permite que continúe hacia el controlador.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El admin no puede entrar aunque esté logueado? → Revisar JWT_CONFIG en config/jwtConfig.js
 * - ¿Aparece "Token expirado" muy seguido? → El token de acceso dura 15 minutos por diseño;
 *   el frontend debe usar el refresh token para renovarlo automáticamente.
 * - Documentación oficial: https://github.com/auth0/node-jsonwebtoken
 * ======================================================
 */

import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwtConfig.js';
import logger from '../utils/logger.js';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    // ======== PASO 1: VERIFICAR QUE HAY TOKEN ========
    logger.debug('Verificando token de acceso', { presente: !!token });

    if (!token) {
        logger.warn('Intento de acceso sin token', { ip: req.ip, path: req.path });
        return res.status(403).json({ error: "Token requerido" });
    }

    // ======== PASO 2: VALIDAR EL TOKEN ========
    try {
        // Verifica que el token es auténtico y no ha sido manipulado.
        // Se especifica explícitamente el algoritmo HS256 para prevenir el ataque
        // "algorithm confusion" (OWASP JWT Cheat Sheet): un atacante podría enviar
        // un token firmado con alg:none o RS256 usando la clave pública como secreto.
        // Forzar HS256 bloquea esa técnica aunque la librería json webtoken v9+
        // ya rechaza alg:none por defecto.
        const decoded = jwt.verify(token, JWT_CONFIG.accessSecret, { algorithms: ['HS256'] });
        logger.debug('Token de acceso válido', { userId: decoded.id || decoded.usuario });
        req.user = decoded;
        next();
    } catch (error) {
        // Registrar siempre los intentos con tokens inválidos (posible ataque)
        logger.security('Token de acceso inválido o expirado', {
            ip: req.ip,
            error: error.message,
            path: req.path
        });

        // Si el token es válido pero expiró, dar mensaje específico
        // para que el frontend pueda renovarlo con el refresh token
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Token expirado" });
        }

        res.status(401).json({ error: "Token inválido" });
    }
};

export default verifyToken;
