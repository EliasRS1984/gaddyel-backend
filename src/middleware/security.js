// src/middleware/security.js
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const applySecurity = (app) => {
    // Helmet: cabeceras básicas de seguridad
    app.use(helmet());

    // Limitar tamaño del body para evitar payloads gigantescos
    app.use(express.json({ limit: '10kb' }));

    // Nota: express-mongo-sanitize y xss-clean tienen conflictos con Express 5.1.0
    // La sanitización de MongoDB se puede hacer a nivel de validación en controllers
    // XSS protection: Helmet ya incluye X-XSS-Protection headers

    // Rate limiter general (ajusta según necesidad)
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 200, // max requests por IP en la ventana
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes, intenta más tarde.' }
    });
    app.use('/api', apiLimiter);

    // Rate limiter específico para login (fuerza bruta)
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 6, // intentos limitados
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de login. Prueba en 15 minutos.' }
    });
    // exportarlo para usarlo solo en la ruta de auth
    return { loginLimiter };
};
