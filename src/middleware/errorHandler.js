// src/middleware/errorHandler.js

/**
 * Middleware global de manejo de errores
 * Evita exponer detalles sensibles en producción
 */
export const errorHandler = (err, req, res, next) => {
    // Log completo en servidor (con stack trace)
    console.error('❌ ERROR:', {
        message: err.message,
        status: err.status || 500,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    // Response al cliente: NO exponer stack en producción
    const isDevelopment = process.env.NODE_ENV === 'development';
    const status = err.status || 500;
    
    res.status(status).json({
        error: isDevelopment 
            ? err.message 
            : 'Error interno del servidor',
        // En desarrollo, permitir debugging
        ...(isDevelopment && { details: err.stack })
    });
};
