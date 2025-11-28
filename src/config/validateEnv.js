// src/config/validateEnv.js

/**
 * Valida que todas las variables de entorno requeridas estén presentes
 * Se ejecuta al inicio del servidor
 */
export function validateEnv() {
    const required = [
        'MONGODB_URI',
        'JWT_ACCESS_SECRET',
        'CLOUDINARY_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'NODE_ENV'
    ];
    
    const missing = required.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
        console.error('❌ Variables de entorno faltantes:');
        missing.forEach(v => console.error(`   - ${v}`));
        throw new Error(`[FATAL] Variables de entorno faltantes: ${missing.join(', ')}`);
    }
    
    console.log('✅ Validación de variables de entorno: EXITOSA');
}
