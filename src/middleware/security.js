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

    // Nota: express-mongo-sanitize y xss-clean tienen conflictos con Express 5.1.0
    // La sanitización de MongoDB se puede hacer a nivel de validación en controllers
    // XSS protection: Helmet ya incluye X-XSS-Protection headers

    // Rate limiter general - Excluir rutas públicas
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: process.env.NODE_ENV === 'production' ? 500 : 1000, // Aumentado para producción
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
        skip: (req) => {
            const ip = req.ip || req.connection.remoteAddress;
            // Saltar rate limiting para:
            // 1. localhost en desarrollo
            // 2. Rutas públicas (GET /api/productos, /api/upload, etc)
            if (process.env.NODE_ENV !== 'production' && 
                (ip === '127.0.0.1' || ip === '::1' || ip?.includes('localhost'))) {
                return true;
            }
            
            // Permitir GET /api/productos sin límite (ruta pública)
            if (req.method === 'GET' && req.path === '/productos') {
                return true;
            }
            
            return false;
        },
        keyGenerator: (req) => {
            // Usar X-Forwarded-For si está disponible (para proxies)
            return req.get('X-Forwarded-For')?.split(',')[0]?.trim() || req.ip;
        }
    });
    app.use('/api', apiLimiter);

    // Rate limiter específico para login - Más flexible en desarrollo
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 20 : 50, // Aumentado para producción
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de login. Prueba en 15 minutos.' },
        skip: (req) => {
            // Saltar rate limiting para localhost en desarrollo
            const ip = req.ip || req.connection.remoteAddress;
            return process.env.NODE_ENV !== 'production' && 
                   (ip === '127.0.0.1' || ip === '::1' || ip?.includes('localhost'));
        },
        keyGenerator: (req) => {
            // Usar X-Forwarded-For si está disponible (para proxies)
            return req.get('X-Forwarded-For')?.split(',')[0]?.trim() || req.ip;
        }
    });
    // exportarlo para usarlo solo en la ruta de auth
    return { loginLimiter };
};
