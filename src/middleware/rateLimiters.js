import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiters para endpoints sensibles del e-commerce
 */

/**
 * Limiter para crear órdenes
 * - 10 órdenes por IP cada 15 minutos
 * - Evita spam de órdenes
 */
export const createOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 órdenes
    message: 'Demasiadas órdenes desde esta dirección IP. Por favor intenta más tarde.',
    standardHeaders: true, // Retorna info del rate limit en el header `RateLimit-*`
    legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
    keyGenerator: (req, res) => {
        // Si es usuario autenticado, usar su ID para límites más altos
        return req.user?.id || ipKeyGenerator(req, res);
    }
});

/**
 * Limiter para webhooks
 * - 100 webhooks por minuto (desde cualquier fuente)
 * - Evita DOS attacks
 */
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // Máximo 100 webhooks
    message: 'Demasiadas notificaciones de webhook. Rate limit excedido.',
    keyGenerator: (req, res) => {
        // Usar X-Request-Id de Mercado Pago como clave
        // Esto previene que una sola IP no pueda hacer todos los webhooks
        return req.headers['x-request-id'] || ipKeyGenerator(req, res);
    },
    // Skip si ya fue procesado (idempotencia)
    skip: (req, res) => {
        // Se puede extender para skipear webhooks duplicados
        return false;
    }
});

/**
 * Limiter para búsquedas de cliente/órdenes
 * - 30 búsquedas por IP cada 15 minutos
 * - Evita scraping de datos
 */
export const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 30, // Máximo 30 búsquedas
    message: 'Demasiadas búsquedas. Por favor intenta más tarde.',
    keyGenerator: ipKeyGenerator
});

/**
 * Limiter general para todas las rutas de mercado pago
 * - 100 requests por IP cada 10 minutos
 */
export const mercadoPagoLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 100,
    message: 'Límite de requests excedido para Mercado Pago. Por favor intenta más tarde.',
    keyGenerator: ipKeyGenerator
});

/**
 * Limiter para crear clientes/datos sensibles
 * - 5 por IP cada 60 minutos
 * - Evita creación masiva de cuentas
 */
export const createClientLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: 'Demasiadas creaciones de cliente. Por favor intenta más tarde.',
    keyGenerator: ipKeyGenerator
});

export default {
    createOrderLimiter,
    webhookLimiter,
    searchLimiter,
    mercadoPagoLimiter,
    createClientLimiter
};
