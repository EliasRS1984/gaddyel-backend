/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Red de seguridad global del servidor.
 * Cuando cualquier parte de la aplicación lanza un error inesperado
 * y nadie más lo maneja, este archivo lo captura como último recurso.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Recibe el error que "se escapó" de algún controlador.
 * 2. Registra todos los detalles del error en el servidor (para debugging).
 * 3. Le responde al cliente un mensaje genérico, sin revelar
 *    detalles técnicos que podrían ayudar a un atacante.
 * 4. En modo desarrollo (local) sí muestra detalles para facilitar debugging.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El servidor responde "Error interno" sin más info? → Revisar los logs del servidor
 *   donde sí se registra el stack trace completo.
 * - ¿Los errores no aparecen en logs? → Revisar que Winston esté configurado en utils/logger.js
 * ======================================================
 */

import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    // Registrar error completo en el servidor (incluye stack trace para debugging)
    logger.error('Error no capturado en controlador', {
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
