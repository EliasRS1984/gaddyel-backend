/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Límites de velocidad para los endpoints más críticos.
 * Cada "limiter" define cuántas veces por minuto/hora puede
 * una misma IP (o usuario) hacer una acción determinada.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cada limiter se aplica como filtro previo a una ruta.
 * 2. Cuenta las solicitudes por IP, por email o por ID de usuario.
 * 3. Si se supera el límite → responde 429 (demasiadas solicitudes)
 *    sin ejecutar la acción.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Un admin legítimo recibe error 429? → Revisar los límites definidos aquí
 * - ¿Llegaron cientos de órdenes falsas? → Revisar createOrderLimiter
 * - Documentación oficial: https://express-rate-limit.mintlify.app/
 * ======================================================
 */

import rateLimit from 'express-rate-limit';

// ======== FUNCIÓN AUXILIAR ========
// Genera la clave de identificación para el rate limiter.
// Usa IP por defecto, que es la forma estándar y compatible con todas las versiones.
const ipKeyGen = (req) => req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';

// ======== LÍMITE PARA CREAR ÓRDENES ========
// Máximo 10 órdenes por usuario/IP cada 15 minutos.
// Usa el email o ID del usuario si está logueado para evitar que
// alguien eluda el límite cambiando de IP.
export const createOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 órdenes
    message: 'Demasiadas órdenes desde esta dirección IP. Por favor intenta más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Prioridad: userId autenticado > email del checkout > IP
        // El email evita que alguien evite el límite cambiando de IP mediante proxies.
        return req.user?.id || req.body?.cliente?.email || ipKeyGen(req);
    }
});

// ======== LÍMITE PARA WEBHOOKS DE MERCADO PAGO ========
// Máximo 100 notificaciones por minuto.
// Usa el ID del request de Mercado Pago como clave cuando está disponible.
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // Máximo 100 webhooks
    message: 'Demasiadas notificaciones de webhook. Rate limit excedido.',
    keyGenerator: (req) => {
        // Usar X-Request-Id de Mercado Pago como clave cuando está disponible.
        // Si no viene el header, usar la IP como fallback.
        return req.headers['x-request-id'] || ipKeyGen(req);
    },
    // Skip si ya fue procesado (idempotencia)
    skip: (req, res) => {
        // Se puede extender para skipear webhooks duplicados
        return false;
    }
});

// ======== LÍMITE PARA BÚSQLÉDA DE DATOS ========
// Máximo 30 búsquedas por IP cada 15 minutos.
// Protege contra scraping masivo de clientes y pedidos.
export const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 30, // Máximo 30 búsquedas
    message: 'Demasiadas búsquedas. Por favor intenta más tarde.',
    keyGenerator: ipKeyGen
});

// ======== LÍMITE PARA RUTAS DE MERCADO PAGO ========
// Máximo 100 requests por IP cada 10 minutos para operaciones de pago.
export const mercadoPagoLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 100,
    message: 'Límite de requests excedido para Mercado Pago. Por favor intenta más tarde.',
    keyGenerator: ipKeyGen
});

// ======== LÍMITE PARA CREAR NUEVOS CLIENTES ========
// Máximo 5 clientes nuevos desde la misma IP por hora.
// Previene la creación masiva automática de cuentas (bots).
export const createClientLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: 'Demasiadas creaciones de cliente. Por favor intenta más tarde.',
    keyGenerator: ipKeyGen
});

export default {
    createOrderLimiter,
    webhookLimiter,
    searchLimiter,
    mercadoPagoLimiter,
    createClientLimiter
};
