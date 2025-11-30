// src/middleware/security.js
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';

export const applySecurity = (app) => {
    // Helmet: cabeceras básicas de seguridad
    app.use(helmet());

    // Limitar tamaño del body para evitar payloads gigantescos
    app.use(express.json({ limit: '10kb' }));

    // Sanitizar contra operadores de Mongo (.$ etc)
    app.use(mongoSanitize());

    // Limpiar inputs para evitar XSS
    app.use(xss());

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
        message: { error: 'Demasiados intentos de login. Prueba en 15 minutos.' }
    });
    // exportarlo para usarlo solo en la ruta de auth
    return { loginLimiter };
};
