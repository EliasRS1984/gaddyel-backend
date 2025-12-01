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

    // Rate limiter general - Más flexible en desarrollo
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: process.env.NODE_ENV === 'production' ? 200 : 1000, // Más permisivo en desarrollo
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
        skip: (req) => {
            // Saltar rate limiting para localhost en desarrollo
            return process.env.NODE_ENV !== 'production' && 
                   (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('localhost'));
        }
    });
    app.use('/api', apiLimiter);

    // Rate limiter específico para login - Más flexible en desarrollo
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 6 : 50, // Más permisivo en desarrollo
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de login. Prueba en 15 minutos.' },
        skip: (req) => {
            // Saltar rate limiting para localhost en desarrollo
            return process.env.NODE_ENV !== 'production' && 
                   (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('localhost'));
        }
    });
    // exportarlo para usarlo solo en la ruta de auth
    return { loginLimiter };
};
