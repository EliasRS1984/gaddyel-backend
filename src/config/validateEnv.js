// src/config/validateEnv.js

/**
 * Valida variables de entorno requeridas
 * 
 * ✅ COMPATIBILIDAD:
 * - Desarrollo: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 * - Render: JWT_SECRET, REFRESH_TOKEN_EXP_DAY
 * - Ambientes: MONGO_URI, CLOUDINARY_*, ALLOWED_ORIGINS
 */
export function validateEnv() {
    // FLUJO: Variables con nombres alternativos soportados
    const varsMaps = {
        'MONGO_URI': ['MONGO_URI', 'MONGODB_URI'],
        'JWT_SECRET': ['JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'],
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
    
    // Mostrar qué variables se detectaron
    if (process.env.JWT_SECRET) {
        console.log('   ✅ JWT_SECRET (Render)');
    }
    if (process.env.JWT_ACCESS_SECRET) {
        console.log('   ✅ JWT_ACCESS_SECRET (Desarrollo)');
    }
    if (process.env.REFRESH_TOKEN_EXP_DAY) {
        console.log(`   ✅ REFRESH_TOKEN_EXP_DAY=${process.env.REFRESH_TOKEN_EXP_DAY} (Render)`);
    }
    if (process.env.ALLOWED_ORIGINS) {
        console.log('   ✅ ALLOWED_ORIGINS');
    }
}

