/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Verificación de las variables de entorno al arrancar el servidor.
 * Antes de que el sistema empiece a atender pedidos, esta función
 * revisa que todas las credenciales necesarias estén configuradas.
 * Si falta algo crítico en producción, el servidor se detiene en lugar
 * de arrancar con funcionalidad rota.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lista todas las variables de entorno requeridas
 * 2. Verifica que cada una exista (acepta nombres alternativos por compatibilidad)
 * 3. En producción: si falta una variable crítica, detiene el servidor
 * 4. En desarrollo: muestra advertencias pero deja continuar para facilitar el trabajo
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El servidor no arranca en producción? → Revisar las variables en el panel de Render
 * - ¿Funciona local pero no en Render? → Comparar el archivo .env local con las
 *   variables configuradas en Render (Settings → Environment)
 * - Variables aceptadas con nombres alternativos:
 *     MONGO_URI   o  MONGODB_URI
 *     JWT_SECRET  o  JWT_ACCESS_SECRET
 *     CLOUDINARY_CLOUD_NAME  o  CLOUDINARY_NAME
 * ======================================================
 */

// ======== VARIABLES REQUERIDAS ========
// Cada entrada tiene el nombre principal y los nombres alternativos aceptados.
// Si ninguno de los alternativos está presente, se considera que falta esa variable.
const VARIABLES_REQUERIDAS = [
    { nombre: 'MONGO_URI',                  alternativas: ['MONGO_URI', 'MONGODB_URI'] },
    { nombre: 'JWT_SECRET',                 alternativas: ['JWT_SECRET', 'JWT_ACCESS_SECRET'] },
    { nombre: 'CLOUDINARY_CLOUD_NAME',      alternativas: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_NAME'] },
    { nombre: 'CLOUDINARY_API_KEY',         alternativas: ['CLOUDINARY_API_KEY'] },
    { nombre: 'CLOUDINARY_API_SECRET',      alternativas: ['CLOUDINARY_API_SECRET'] },
    // Sin este token el procesador de pagos no puede funcionar
    { nombre: 'MERCADO_PAGO_ACCESS_TOKEN',  alternativas: ['MERCADO_PAGO_ACCESS_TOKEN'] },
    // Sin este secreto no se pueden verificar las notificaciones de pago de Mercado Pago
    { nombre: 'MERCADO_PAGO_WEBHOOK_SECRET', alternativas: ['MERCADO_PAGO_WEBHOOK_SECRET', 'MP_WEBHOOK_SECRET'] }
];

// ======== VERIFICACIÓN AL ARRANCAR ========
// Esta función se llama una sola vez cuando el servidor inicia.
// ¿El servidor se detiene solo? Buscar "Variables de entorno faltantes" en los logs.
export function validateEnv() {
    const isProduction = process.env.NODE_ENV === 'production';

    const faltantes = VARIABLES_REQUERIDAS.filter(
        ({ alternativas }) => !alternativas.some(nombre => process.env[nombre])
    );

    if (faltantes.length > 0) {
        const nombresLegibles = faltantes.map(v => `   - ${v.nombre}`).join('\n');

        if (isProduction) {
            // En producción no se puede operar con credenciales faltantes —
            // es mejor detener el servidor ahora que fallar en medio de un pedido.
            console.error('❌ Variables de entorno críticas faltantes en producción:');
            console.error(nombresLegibles);
            process.exit(1);
        } else {
            // En desarrollo se avisa pero se continúa para no bloquear el trabajo local
            console.warn('⚠️  Variables de entorno faltantes (algunos endpoints no funcionarán):');
            console.warn(nombresLegibles);
        }
    } else {
        console.log('✅ Todas las variables de entorno están configuradas');
    }

    // Mostrar detalle de qué variante se detectó (solo en desarrollo)
    if (!isProduction) {
        if (process.env.JWT_SECRET)          console.log('   ✅ JWT_SECRET detectado (modo Render)');
        if (process.env.JWT_ACCESS_SECRET)   console.log('   ✅ JWT_ACCESS_SECRET detectado (modo desarrollo)');
        if (process.env.REFRESH_TOKEN_EXP_DAYS) console.log(`   ✅ REFRESH_TOKEN_EXP_DAYS=${process.env.REFRESH_TOKEN_EXP_DAYS}`);
        if (process.env.ALLOWED_ORIGINS)     console.log('   ✅ ALLOWED_ORIGINS configurado');
    }
}

