/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Configuración central de seguridad del servidor.
 * Aplica protecciones estándar de industria en TODAS las rutas
 * de una vez: cabeceras seguras, límites de tamaño de datos y
 * límites de velocidad para evitar abusos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Helmet agrega cabeceras HTTP que protegen contra ataques web comunes.
 * 2. El límite de 10kb en el body evita que alguien envíe archivos enormes
 *    para saturar el servidor.
 * 3. Los rate limiters controlan cuántas veces por ventana de tiempo
 *    puede acceder cada IP a cada tipo de ruta.
 * 4. Esta función exporta los limiters específicos (login, escritura, upload)
 *    para que las rutas que los necesiten los apliquen individualmente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El servidor no procesa el body de un request? → Revisar el límite de 10kb
 * - ¿Las cabeceras de seguridad están ausentes? → Revisar la configuración de Helmet
 * - ¿Usuarios legítimos reciben 429? → Ajustar los max en los limiters según el tráfico real
 * - Documentación oficial: https://helmetjs.github.io/ | https://express-rate-limit.mintlify.app/
 * ======================================================
 */

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const applySecurity = (app) => {
    // Helmet: cabeceras básicas de seguridad
    app.use(helmet());

    // Limitar tamaño del body para evitar payloads gigantescos
    app.use(express.json({ limit: '10kb' }));

    // Trust proxy para obtener IP real en Render/Heroku
    app.set('trust proxy', 1);

    // ======== DETECCIÓN DE ENTORNO LOCAL ========
    // Detecta si la solicitud viene de la misma máquina (desarrollo local).
    // En desarrollo, los rate limiters aplican límites más altos para no bloquear al dev.
    const isLocalhost = (req) => {
        // req.socket.remoteAddress reemplaza req.connection.remoteAddress (obsoleto en Node.js 18+)
        const ip = req.ip || req.socket?.remoteAddress;
        return (ip === '127.0.0.1' || ip === '::1' || ip?.includes('localhost'));
    };

    // ======== RATE LIMITER GENERAL ========
    // Aplica a todas las rutas /api. Límite alto para no bloquear uso normal.
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: process.env.NODE_ENV === 'production' ? 200 : 1000, // 200 req/15min = ~13 req/min
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
        skip: (req) => {
            // Saltar en localhost desarrollo
            if (process.env.NODE_ENV !== 'production' && isLocalhost(req)) return true;
            
            // Saltar para GET /api/productos (ruta pública)
            if (req.method === 'GET' && req.path.includes('/productos')) return true;
            
            return false;
        }
    });
    app.use('/api', apiLimiter);

    // ======== RATE LIMITER DE ESCRITURA ========
    // Aplica a POST/PUT/DELETE. Más estricto para evitar modificaciones masivas.
    const writeLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 50 : 200, // 50 escrituras/15min
        skipSuccessfulRequests: true, // No cuenta requests exitosos
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes de escritura. Intenta más tarde.' },
        skip: (req) => process.env.NODE_ENV !== 'production' && isLocalhost(req)
    });

    // ======== RATE LIMITER DE LOGIN ========
    // Muy estricto: máximo 5 intentos fallidos en 15 minutos.
    // Protege contra ataques de fuerza bruta sobre el panel de administración.
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 5 : 20, // Máximo 5 intentos
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de login. Intenta en 15 minutos.' },
        skip: (req) => process.env.NODE_ENV !== 'production' && isLocalhost(req)
    });

    // ======== RATE LIMITER DE UPLOADS ========
    // Límite de 20 subidas por hora en producción. Evita abuso del almacenamiento de Cloudinary.
    const uploadLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hora
        max: process.env.NODE_ENV === 'production' ? 20 : 100, // 20 uploads/hora
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Límite de uploads alcanzado. Intenta en 1 hora.' },
        skip: (req) => process.env.NODE_ENV !== 'production' && isLocalhost(req)
    });

    // Exportar limiters para usar en rutas específicas
    return { loginLimiter, writeLimiter, uploadLimiter };
};
