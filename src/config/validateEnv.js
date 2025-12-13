// src/config/validateEnv.js

/**
 * Valida variables de entorno requeridas
 * Soporta múltiples nombres para compatibilidad (desarrollo vs Render)
 * IMPORTANTE: No lanzar error fatal - solo loguear advertencias
 */
export function validateEnv() {
    // Variables con nombres alternativos soportados
    const varsMaps = {
        'MONGO_URI': ['MONGO_URI', 'MONGODB_URI'],
        'JWT_SECRET': ['JWT_SECRET', 'JWT_ACCESS_SECRET'],
        'CLOUDINARY_CLOUD_NAME': ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_NAME'],
        'CLOUDINARY_API_KEY': ['CLOUDINARY_API_KEY'],
        'CLOUDINARY_API_SECRET': ['CLOUDINARY_API_SECRET'],
    };
    
    const missing = [];
    
    Object.entries(varsMaps).forEach(([mainName, alternatives]) => {
        const found = alternatives.some(alt => process.env[alt]);
        if (!found) {
            missing.push(mainName);
        }
    });
    
    if (missing.length > 0) {
        console.warn('⚠️  Variables de entorno faltantes:');
        missing.forEach(v => console.warn(`   - ${v}`));
        console.warn('   ⚠️  La aplicación continuará, pero algunos endpoints no funcionarán');
    } else {
        console.log('✅ Todas las variables de entorno están configuradas');
    }
}

