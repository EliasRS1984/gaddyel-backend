/**
 * Configuración centralizada de JWT
 * Una sola fuente de verdad para secrets y configuración
 * 
 * ✅ Compatible con múltiples nombres de variables:
 * - Desarrollo: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 * - Render: JWT_SECRET (para ambos, usando REFRESH_TOKEN_EXP_DAY para refresh)
 */

export const getJWTSecrets = () => {
    // FLUJO: Buscar en este orden:
    // 1. JWT_ACCESS_SECRET (preferido en desarrollo)
    // 2. JWT_SECRET (usado en Render)
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    
    // FLUJO: Para refresh, intentar primero JWT_REFRESH_SECRET, luego JWT_SECRET
    // Si en Render solo usan JWT_SECRET para ambos, se usará el mismo
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    if (!accessSecret) {
        throw new Error(
            'JWT_ACCESS_SECRET o JWT_SECRET no configurado. Agrega a .env:\n' +
            'JWT_ACCESS_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    if (!refreshSecret) {
        throw new Error(
            'JWT_REFRESH_SECRET o JWT_SECRET no configurado. Agrega a .env:\n' +
            'JWT_REFRESH_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    return {
        accessSecret,
        refreshSecret,
        accessExpiry: '15m',
        // FLUJO: Respetar REFRESH_TOKEN_EXP_DAY si existe (desde Render)
        refreshExpiry: process.env.REFRESH_TOKEN_EXP_DAY 
            ? `${process.env.REFRESH_TOKEN_EXP_DAY}d`
            : '7d'
    };
};

// Singleton: validar al inicio de la aplicación
export const JWT_CONFIG = getJWTSecrets();
