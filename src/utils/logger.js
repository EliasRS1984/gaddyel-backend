// =======================================================================
// ¿QUÉ ES ESTO?
// Sistema de registro de eventos del servidor (logger) usando Winston.
//
// ¿CÓMO FUNCIONA?
// 1. Todo mensaje que se quiera registrar pasa por este módulo.
// 2. En desarrollo: los mensajes aparecen con colores en la consola.
// 3. En producción: los mensajes se guardan en archivos de texto y en consola.
// 4. Los errores siempre se guardan en logs/error.log.
// 5. Todos los eventos (info, warn, error) se guardan en logs/combined.log.
//
// ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
// - ¿No aparecen logs? Revisa que la carpeta logs/ existe en el proyecto.
// - ¿Quieres ver solo errores? Lee el archivo logs/error.log.
// - ¿Quieres todos los eventos? Lee logs/combined.log.
// =======================================================================

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDevelopment = process.env.NODE_ENV !== 'production';

// ======= FORMATO DE MENSAJES EN CONSOLA (DESARROLLO) =======
// Muestra: [HH:MM:SS] NIVEL: mensaje
const formatoConsola = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] ${level}: ${message}${extra}`;
    })
);

// ======= FORMATO DE MENSAJES EN ARCHIVO (PRODUCCIÓN) =======
// Guarda en JSON estructurado para facilitar análisis posterior
const formatoArchivo = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// ======= CONFIGURACIÓN DE DESTINOS DE LOS LOGS =======
const transportes = [
    // Siempre mostrar en consola
    new winston.transports.Console({
        format: isDevelopment ? formatoConsola : winston.format.json(),
        // En desarrollo: mostrar todos los niveles. En producción: solo warn y error
        level: isDevelopment ? 'debug' : 'warn'
    })
];

// En producción guardar logs en archivos físicos
if (!isDevelopment) {
    const logsDir = path.join(__dirname, '../../logs');
    transportes.push(
        // Solo errores críticos
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: formatoArchivo,
            maxsize: 5 * 1024 * 1024, // 5 MB máximo por archivo
            maxFiles: 5              // Conservar los últimos 5 archivos
        }),
        // Todos los eventos (info, warn, error)
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: formatoArchivo,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        })
    );
}

// ======= INSTANCIA PRINCIPAL DEL LOGGER =======
const winstonLogger = winston.createLogger({
    level: isDevelopment ? 'debug' : 'info',
    transports: transportes,
    // El proceso NO debe detenerse si Winston falla al escribir
    exitOnError: false
});

// ======= INTERFAZ COMPATIBLE CON EL LOGGER ANTERIOR =======
// Mantiene las mismas funciones (debug, info, warn, error, security)
// para no tener que cambiar el código que ya usa este módulo.
const logger = {
    debug: (message, data = null) => {
        winstonLogger.debug(message, data ? { data } : {});
    },
    info: (message, data = null) => {
        winstonLogger.info(message, data ? { data } : {});
    },
    warn: (message, data = null) => {
        winstonLogger.warn(message, data ? { data } : {});
    },
    error: (message, data = null) => {
        // ✅ SEGURIDAD: Si 'data' es un Error, loguear solo el mensaje, nunca el stack completo en producción
        if (data instanceof Error) {
            winstonLogger.error(message, {
                errorMessage: data.message,
                ...(isDevelopment && { stack: data.stack })
            });
        } else {
            winstonLogger.error(message, data ? { data } : {});
        }
    },
    // Nivel especial para eventos de seguridad (accesos denegados, intentos de ataque)
    security: (message, data = null) => {
        winstonLogger.warn(`[SECURITY] ${message}`, data ? { data } : {});
    }
};

export default logger;
