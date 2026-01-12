#!/usr/bin/env node
/**
 * Script para verificar que variables de entorno de Cloudinary están correctamente configuradas
 * Ejecutar: node check-cloudinary-env.js
 */

const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = [];
const found = [];

console.log('\n🔍 Verificando variables de entorno Cloudinary...\n');

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
        missing.push(varName);
        console.log(`❌ ${varName}: NO CONFIGURADA`);
    } else {
        // Mostrar solo primeros/últimos caracteres por seguridad
        const masked = value.length > 20 
            ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}` 
            : '***';
        found.push(varName);
        console.log(`✅ ${varName}: ${masked} (length: ${value.length})`);
    }
});

console.log('\n' + '='.repeat(60));

if (missing.length === 0) {
    console.log('✅ TODAS las variables están configuradas correctamente\n');
    console.log('Resumen:');
    console.log(`  Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`  API Key length: ${process.env.CLOUDINARY_API_KEY?.length || 0}`);
    console.log(`  API Secret length: ${process.env.CLOUDINARY_API_SECRET?.length || 0}`);
    process.exit(0);
} else {
    console.log(`❌ FALTANDO ${missing.length} variable(s):\n`);
    missing.forEach(v => console.log(`  - ${v}`));
    console.log('\n📖 Instrucciones: Ver CLOUDINARY_ENV_SETUP.md\n');
    process.exit(1);
}
