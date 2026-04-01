/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Configuración central de los tokens de sesión (JWT).
 * Un JWT es un código cifrado que el servidor le entrega al usuario
 * al iniciar sesión. Con ese código, el usuario puede hacer
 * solicitudes sin tener que ingresar su contraseña cada vez.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lee las claves secretas desde el archivo .env
 * 2. Verifica que las claves existan y sean suficientemente largas
 * 3. Expone una función que devuelve la configuración cuando se la pide
 *    (no al cargar el archivo — esto evita errores si .env se carga tarde)
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error "JWT_SECRET debe tener mínimo 32 caracteres"?
 *   → La clave en .env es demasiado corta. Generar una nueva con:
 *      openssl rand -hex 32
 * - ¿Sesiones que expiran de inmediato?
 *   → Verificar JWT_ACCESS_EXPIRY en .env (por defecto: 15m)
 * - ¿El refresh token no funciona?
 *   → Verificar REFRESH_TOKEN_EXP_DAYS en .env (por defecto: 7 días)
 * - Nombres de variables aceptados:
 *     Desarrollo: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 *     Render:     JWT_SECRET (se usa para ambos)
 * ======================================================
 */

// ======== LECTURA Y VALIDACIÓN DE CLAVES JWT ========
// Esta función se llama cada vez que se necesita la configuración.
// Al ser una función (no una constante), se ejecuta DESPUÉS de que
// dotenv cargó el archivo .env, evitando el problema de módulos que
// se evalúan antes que las variables de entorno estén disponibles.
// ¿Error al arrancar el servidor? Revisar las variables JWT en .env
export const getJWTSecrets = () => {
    const accessSecret  = process.env.JWT_ACCESS_SECRET  || process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    if (!accessSecret) {
        throw new Error(
            'JWT_ACCESS_SECRET o JWT_SECRET no configurado.\n' +
            'Agrega al .env: JWT_ACCESS_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    // Una clave muy corta es fácilmente adivinable.
    // OWASP recomienda mínimo 256 bits = 32 caracteres para tokens JWT.
    if (accessSecret.length < 32) {
        throw new Error(
            'JWT_SECRET debe tener mínimo 32 caracteres para ser seguro.\n' +
            'Genera uno nuevo con: openssl rand -hex 32'
        );
    }

    if (!refreshSecret) {
        throw new Error(
            'JWT_REFRESH_SECRET o JWT_SECRET no configurado.\n' +
            'Agrega al .env: JWT_REFRESH_SECRET=<generar con: openssl rand -hex 32>'
        );
    }

    return {
        accessSecret,
        refreshSecret,
        // Tiempo de vida del token de acceso (corto por seguridad)
        accessExpiry:  process.env.JWT_ACCESS_EXPIRY || '15m',
        // Tiempo de vida del token de renovación (más largo para comodidad del usuario)
        refreshExpiry: process.env.REFRESH_TOKEN_EXP_DAYS
            ? `${process.env.REFRESH_TOKEN_EXP_DAYS}d`
            : '7d'
    };
};

// ======== OBJETO DE CONFIGURACIÓN ACCESIBLE ========
// Algunos archivos importan JWT_CONFIG directamente.
// Se define como un objeto con propiedades calculadas en el momento de acceso
// (getters) para que la lectura de process.env ocurra cuando se necesita,
// no cuando el módulo se carga por primera vez.
// ¿Error "Cannot read property of undefined"? Verificar las claves JWT en .env
export const JWT_CONFIG = {
    get accessSecret()  { return getJWTSecrets().accessSecret; },
    get refreshSecret() { return getJWTSecrets().refreshSecret; },
    get accessExpiry()  { return getJWTSecrets().accessExpiry; },
    get refreshExpiry() { return getJWTSecrets().refreshExpiry; }
};
