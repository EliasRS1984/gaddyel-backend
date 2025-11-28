// src/config/validateEnv.js

/**
 * Valida variables de entorno requeridas
 * IMPORTANTE: No lanzar error fatal - solo loguear advertencias
 * Render inyecta vars en runtime, no en build time
 */
export function validateEnv() {
    const required = [
        'MONGODB_URI',
        'JWT_ACCESS_SECRET',
        'CLOUDINARY_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
    ];
    
    const missing = required.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
        console.warn('⚠️  Variables de entorno faltantes:');
        missing.forEach(v => console.warn(`   - ${v}`));
        console.warn('   ⚠️  La aplicación continuará, pero algunos endpoints no funcionarán');
    } else {
        console.log('✅ Todas las variables de entorno están configuradas');
    }
}

