/**
 * Configuración centralizada de JWT
 * Una sola fuente de verdad para secrets y configuración
 * ✅ SOLUCIÓN: JWT centralizados con secrets separados
 */

export const getJWTSecrets = () => {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret) {
        throw new Error(
            'JWT_ACCESS_SECRET no configurado. Agrega a .env:\n' +
            'JWT_ACCESS_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    if (!refreshSecret) {
        throw new Error(
            'JWT_REFRESH_SECRET no configurado. Agrega a .env:\n' +
            'JWT_REFRESH_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    return {
        accessSecret,
        refreshSecret,
        accessExpiry: '15m',
        refreshExpiry: '7d'
    };
};

// Singleton: validar al inicio de la aplicación
export const JWT_CONFIG = getJWTSecrets();
