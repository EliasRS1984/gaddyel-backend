// src/middleware/security.js
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

    // ✅ Helper para detectar localhost
    const isLocalhost = (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        return (ip === '127.0.0.1' || ip === '::1' || ip?.includes('localhost'));
    };

    // ✅ RATE LIMITER GENERAL - Menos estricto
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

    // ✅ RATE LIMITER PARA ESCRITURA (POST/PUT/DELETE) - Más estricto
    const writeLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 50 : 200, // 50 escrituras/15min
        skipSuccessfulRequests: true, // No cuenta requests exitosos
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes de escritura. Intenta más tarde.' },
        skip: (req) => process.env.NODE_ENV !== 'production' && isLocalhost(req)
    });

    // ✅ RATE LIMITER PARA LOGIN - Muy estricto
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 5 : 20, // Máximo 5 intentos
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de login. Intenta en 15 minutos.' },
        skip: (req) => process.env.NODE_ENV !== 'production' && isLocalhost(req)
    });

    // ✅ RATE LIMITER PARA UPLOAD - Muy restrictivo
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
