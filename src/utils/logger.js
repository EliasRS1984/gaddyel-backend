import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, '..', '..', 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Niveles de log: DEBUG, INFO, WARNING, ERROR, CRITICAL
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4
};

/**
 * Registro de auditoría estructurado para operaciones críticas
 * @param {string} action - Acción realizada (ORDER_CREATED, PAYMENT_APPROVED, etc)
 * @param {object} details - Detalles de la operación
 * @param {string} level - Nivel de log (INFO, WARNING, ERROR, CRITICAL)
 * @param {object} metadata - Información adicional (userId, ipAddress, etc)
 */
export const logAudit = (action, details, level = 'INFO', metadata = {}) => {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            action,
            details,
            metadata: {
                nodeEnv: process.env.NODE_ENV,
                ...metadata
            }
        };

        // Formato para archivo
        const logString = JSON.stringify(logEntry) + '\n';

        // Determinar archivo de log según el tipo de acción
        const category = action.split('_')[0]; // ORDER, PAYMENT, WEBHOOK, etc
        const filename = `audit-${category}-${new Date().toISOString().split('T')[0]}.log`;
        const filepath = path.join(logDir, filename);

        // Escribir en archivo (asíncrono, no bloquea)
        fs.appendFile(filepath, logString, (err) => {
            if (err) {
                console.error(`Error escribiendo log: ${err.message}`);
            }
        });

        // Consola en desarrollo
        if (process.env.NODE_ENV === 'development') {
            const colorCode = {
                DEBUG: '\x1b[36m',    // Cyan
                INFO: '\x1b[32m',     // Green
                WARNING: '\x1b[33m',  // Yellow
                ERROR: '\x1b[31m',    // Red
                CRITICAL: '\x1b[41m'  // Red background
            };
            const resetCode = '\x1b[0m';
            const color = colorCode[level] || '\x1b[0m';

            console.log(
                `${color}[${timestamp}][${level}] ${action}${resetCode}`,
                JSON.stringify(details, null, 2)
            );
        }

    } catch (err) {
        console.error(`Error en logAudit: ${err.message}`);
    }
};

/**
 * Registrar operación de orden
 */
export const logOrderOperation = (action, order, details = {}) => {
    logAudit(`ORDER_${action}`, {
        orderId: order?._id,
        orderNumber: order?.orderNumber,
        clientId: order?.clienteId,
        total: order?.total,
        status: order?.estadoPago,
        ...details
    }, 'INFO', {
        orderId: order?._id?.toString()
    });
};

/**
 * Registrar operación de pago
 */
export const logPaymentOperation = (action, payment, details = {}) => {
    logAudit(`PAYMENT_${action}`, {
        paymentId: payment?.id,
        orderId: payment?.external_reference,
        status: payment?.status,
        amount: payment?.transaction_amount,
        method: payment?.payment_method_id,
        ...details
    }, 'INFO', {
        paymentId: payment?.id?.toString()
    });
};

/**
 * Registrar operación de webhook
 */
export const logWebhookOperation = (action, webhook, details = {}) => {
    logAudit(`WEBHOOK_${action}`, {
        webhookType: webhook?.type,
        externalId: webhook?.external_id,
        status: webhook?.status,
        ...details
    }, 'INFO');
};

/**
 * Registrar error crítico
 */
export const logCriticalError = (action, error, details = {}) => {
    logAudit(`${action}_ERROR`, {
        message: error?.message,
        stack: error?.stack ? error.stack.split('\n').slice(0, 5) : undefined,
        ...details
    }, 'CRITICAL');
};

/**
 * Limpiar logs antiguos (más de 30 días)
 */
export const cleanOldLogs = () => {
    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        fs.readdirSync(logDir).forEach(file => {
            const filepath = path.join(logDir, file);
            const stats = fs.statSync(filepath);

            if (stats.mtimeMs < thirtyDaysAgo) {
                fs.unlinkSync(filepath);
                console.log(`🗑️  Log antiguo eliminado: ${file}`);
            }
        });
    } catch (err) {
        console.error(`Error limpiando logs antiguos: ${err.message}`);
    }
};

/**
 * Leer logs de un período específico
 */
export const getLogs = (action, days = 7) => {
    try {
        const logs = [];
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);

        fs.readdirSync(logDir).forEach(file => {
            if (file.includes(action)) {
                const filepath = path.join(logDir, file);
                const content = fs.readFileSync(filepath, 'utf8');
                const lines = content.split('\n').filter(l => l);

                lines.forEach(line => {
                    try {
                        const log = JSON.parse(line);
                        if (new Date(log.timestamp).getTime() > since) {
                            logs.push(log);
                        }
                    } catch (e) {
                        // Skip malformed lines
                    }
                });
            }
        });

        return logs.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    } catch (err) {
        console.error(`Error leyendo logs: ${err.message}`);
        return [];
    }
};

export default {
    logAudit,
    logOrderOperation,
    logPaymentOperation,
    logWebhookOperation,
    logCriticalError,
    cleanOldLogs,
    getLogs
};
