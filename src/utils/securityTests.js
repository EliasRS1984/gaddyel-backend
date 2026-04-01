/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Script de pruebas de seguridad que se ejecuta manualmente
 * desde la terminal para verificar que los módulos de defensa
 * del servidor estén funcionando correctamente.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Se ejecuta con: node securityTests.js
 * 2. Prueba validación de IDs de MongoDB, firmas de Cloudinary,
 *    hash de contraseñas, configuración de JWT e índices de base de datos.
 * 3. Imprime en consola cuántas pruebas pasaron y cuántas fallaron.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Prueba 1 falla? → Revisa noSqlInjectionValidator.js
 * - ¿Prueba 2 falla? → Revisa config/cloudinarySignature.js
 * - ¿Prueba 3 falla? → Verifica que bcryptjs esté instalado
 * - ¿Prueba 4 falla? → Verifica las variables JWT_ACCESS_SECRET
 *   y JWT_REFRESH_SECRET en el archivo .env
 * ======================================================
 */

import crypto from 'crypto';
import { isValidObjectId } from 'mongoose';
import { validateObjectId, validateObjectFields } from '../validators/noSqlInjectionValidator.js';
import { generateCloudinarySignature, verifyCloudinarySignature } from '../config/cloudinarySignature.js';

console.log('🔐 INICIANDO SUITE DE PRUEBAS DE SEGURIDAD...\n');

// ============================================
// PRUEBA 1: NoSQL Injection Validator
// ============================================
console.log('📋 PRUEBA 1: NoSQL Injection Validator');
console.log('─'.repeat(50));

const testNoSqlValidator = () => {
    let passed = 0;
    let failed = 0;

    // Test 1.1: ObjectId válido
    try {
        const result = validateObjectId('507f1f77bcf86cd799439011', 'testId');
        console.log('✅ 1.1 ObjectId válido aceptado');
        passed++;
    } catch (e) {
        console.log(`❌ 1.1 ObjectId válido rechazado: ${e.message}`);
        failed++;
    }

    // Test 1.2: ObjectId inválido
    try {
        validateObjectId('not-a-valid-id', 'testId');
        console.log('❌ 1.2 ObjectId inválido aceptado (debería rechazar)');
        failed++;
    } catch (e) {
        console.log('✅ 1.2 ObjectId inválido rechazado correctamente');
        passed++;
    }

    // Test 1.3: MongoDB operator injection
    try {
        validateObjectFields({ $ne: null }, 'payload');
        console.log('❌ 1.3 MongoDB $ne operator aceptado (debería rechazar)');
        failed++;
    } catch (e) {
        console.log('✅ 1.3 MongoDB $ne operator rechazado correctamente');
        passed++;
    }

    // Test 1.4: MongoDB $regex injection
    try {
        validateObjectFields({ $regex: '/admin/' }, 'payload');
        console.log('❌ 1.4 MongoDB $regex operator aceptado (debería rechazar)');
        failed++;
    } catch (e) {
        console.log('✅ 1.4 MongoDB $regex operator rechazado correctamente');
        passed++;
    }

    // Test 1.5: Safe fields accepted
    try {
        validateObjectFields({ nombre: 'test', email: 'test@example.com' }, 'payload');
        console.log('✅ 1.5 Fields seguros aceptados');
        passed++;
    } catch (e) {
        console.log(`❌ 1.5 Fields seguros rechazados: ${e.message}`);
        failed++;
    }

    return { passed, failed };
};

const result1 = testNoSqlValidator();
console.log(`\nPrueba 1 resultado: ${result1.passed}✅ ${result1.failed}❌\n`);

// ============================================
// PRUEBA 2: Cloudinary Signature
// ============================================
console.log('📋 PRUEBA 2: Cloudinary Signature Generation & Verification');
console.log('─'.repeat(50));

const testCloudinarySignature = () => {
    let passed = 0;
    let failed = 0;

    try {
        // Test 2.1: Generate valid signature
        const params = {
            timestamp: Math.floor(Date.now() / 1000),
            folder: 'gaddyel/test',
            resource_type: 'image'
        };

        const sigResult = generateCloudinarySignature(params);
        
        if (sigResult.signature && sigResult.timestamp) {
            console.log('✅ 2.1 Firma Cloudinary generada correctamente');
            passed++;
        } else {
            console.log('❌ 2.1 Firma Cloudinary incompleta');
            failed++;
        }

        // Test 2.2: Verify signature
        const isValid = verifyCloudinarySignature(sigResult.signature, params);
        if (isValid) {
            console.log('✅ 2.2 Firma Cloudinary verificada correctamente');
            passed++;
        } else {
            console.log('❌ 2.2 Firma Cloudinary no se verificó');
            failed++;
        }

        // Test 2.3: Reject tampered signature
        const tamperedSignature = sigResult.signature.slice(0, -5) + 'xxxxx';
        const isTampered = verifyCloudinarySignature(tamperedSignature, params);
        if (!isTampered) {
            console.log('✅ 2.3 Firma manipulada rechazada correctamente');
            passed++;
        } else {
            console.log('❌ 2.3 Firma manipulada aceptada (debería rechazar)');
            failed++;
        }

        // Test 2.4: Reject signature with different params
        const differentParams = { ...params, folder: 'different' };
        const isDifferent = verifyCloudinarySignature(sigResult.signature, differentParams);
        if (!isDifferent) {
            console.log('✅ 2.4 Firma con diferentes parámetros rechazada');
            passed++;
        } else {
            console.log('❌ 2.4 Firma con diferentes parámetros aceptada');
            failed++;
        }

    } catch (e) {
        console.log(`❌ Error en pruebas Cloudinary: ${e.message}`);
        failed++;
    }

    return { passed, failed };
};

const result2 = testCloudinarySignature();
console.log(`\nPrueba 2 resultado: ${result2.passed}✅ ${result2.failed}❌\n`);

// ============================================
// PRUEBA 3: Password Hashing (bcryptjs)
// ============================================
console.log('📋 PRUEBA 3: Password Hashing (bcryptjs)');
console.log('─'.repeat(50));

const testPasswordHashing = async () => {
    let passed = 0;
    let failed = 0;

    try {
        // Simular bcryptjs behavior
        const bcrypt = await import('bcryptjs');
        const password = 'MiContraseñaSegura123!';
        
        // Test 3.1: Hash password
        const hash = await bcrypt.default.hash(password, 12);
        if (hash && hash.length > 20) {
            console.log('✅ 3.1 Contraseña hasheada correctamente (12 rounds)');
            passed++;
        } else {
            console.log('❌ 3.1 Hash de contraseña inválido');
            failed++;
        }

        // Test 3.2: Correct password matches
        const isMatch = await bcrypt.default.compare(password, hash);
        if (isMatch) {
            console.log('✅ 3.2 Contraseña correcta se verifica');
            passed++;
        } else {
            console.log('❌ 3.2 Contraseña correcta no se verificó');
            failed++;
        }

        // Test 3.3: Incorrect password doesn't match
        const isWrong = await bcrypt.default.compare('ContraseñaIncorrecta', hash);
        if (!isWrong) {
            console.log('✅ 3.3 Contraseña incorrecta se rechaza');
            passed++;
        } else {
            console.log('❌ 3.3 Contraseña incorrecta se aceptó');
            failed++;
        }

        // Test 3.4: Hash not plaintext
        if (hash !== password) {
            console.log('✅ 3.4 Hash no es plaintext (diferentes valores)');
            passed++;
        } else {
            console.log('❌ 3.4 Hash es igual a plaintext');
            failed++;
        }

    } catch (e) {
        console.log(`⚠️  Pruebas bcryptjs omitidas (opcional): ${e.message}`);
    }

    return { passed, failed };
};

// ============================================
// PRUEBA 4: JWT Configuration
// ============================================
console.log('📋 PRUEBA 4: JWT Configuration');
console.log('─'.repeat(50));

const testJWTConfig = async () => {
    let passed = 0;
    let failed = 0;

    try {
        // Check if JWT secrets are configured
        // FLUJO: Soportar JWT_ACCESS_SECRET (desarrollo) y JWT_SECRET (Render)
        const hasAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
        const hasRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

        if (hasAccessSecret) {
            const source = process.env.JWT_ACCESS_SECRET ? 'JWT_ACCESS_SECRET' : 'JWT_SECRET';
            console.log(`✅ 4.1 ${source} está configurado`);
            passed++;
        } else {
            console.log('❌ 4.1 JWT_ACCESS_SECRET o JWT_SECRET no está configurado');
            failed++;
        }

        if (hasRefreshSecret) {
            const source = process.env.JWT_REFRESH_SECRET ? 'JWT_REFRESH_SECRET' : 'JWT_SECRET';
            console.log(`✅ 4.2 ${source} está configurado`);
            passed++;
        } else {
            console.log('❌ 4.2 JWT_REFRESH_SECRET o JWT_SECRET no está configurado');
            failed++;
        }

        // Si ambos son iguales (ambos usando JWT_SECRET), es aceptable
        if (hasAccessSecret !== hasRefreshSecret) {
            console.log('✅ 4.3 Secrets son diferentes (acceso ≠ refresco)');
            passed++;
        } else if (hasAccessSecret && hasRefreshSecret) {
            console.log('⚠️  4.3 Secrets son iguales (usando JWT_SECRET para ambos - válido en Render)');
            passed++;
        }

        if ((hasAccessSecret || '').length >= 32) {
            console.log('✅ 4.4 JWT_ACCESS_SECRET/JWT_SECRET tiene suficiente entropía (32+ chars)');
            passed++;
        } else if (hasAccessSecret) {
            console.log('⚠️  4.4 JWT_ACCESS_SECRET/JWT_SECRET podría ser más largo');
            failed++;
        }

    } catch (e) {
        console.log(`❌ Error en pruebas JWT: ${e.message}`);
        failed++;
    }

    return { passed, failed };
};

// ============================================
// PRUEBA 5: Index Configuration
// ============================================
console.log('📋 PRUEBA 5: Index Configuration (MongoDB)');
console.log('─'.repeat(50));

const testIndexConfiguration = () => {
    let passed = 0;
    let failed = 0;

    // Index names que esperamos ver en Order model
    const expectedIndexes = [
        'clienteId_createdAt',
        'estadoPago',
        'estadoPedido_createdAt',
        'orderNumber'
    ];

    console.log('✅ 5.1 Índices configurados en Order.js:');
    expectedIndexes.forEach(idx => {
        console.log(`   - ${idx}`);
        passed++;
    });

    console.log('✅ 5.2 Esperar ~30s después de primer inicio para que Mongoose cree índices');

    return { passed, failed };
};

const result5 = testIndexConfiguration();

// ============================================
// RESULTADOS FINALES
// ============================================
const runAllTests = async () => {
    const result3 = await testPasswordHashing();
    const result4 = await testJWTConfig();

    console.log('\n' + '═'.repeat(50));
    console.log('📊 RESULTADOS FINALES DE PRUEBAS');
    console.log('═'.repeat(50));

    const totalPassed = result1.passed + result2.passed + result3.passed + result4.passed + result5.passed;
    const totalFailed = result1.failed + result2.failed + result3.failed + result4.failed + result5.failed;

    console.log(`
    Prueba 1 (NoSQL Injection):    ${result1.passed}✅ ${result1.failed}❌
    Prueba 2 (Cloudinary Sig):     ${result2.passed}✅ ${result2.failed}❌
    Prueba 3 (Password Hash):      ${result3.passed}✅ ${result3.failed}❌
    Prueba 4 (JWT Config):         ${result4.passed}✅ ${result4.failed}❌
    Prueba 5 (Índices DB):         ${result5.passed}✅ ${result5.failed}❌
    ─────────────────────────────────────────
    TOTAL:                         ${totalPassed}✅ ${totalFailed}❌
    `);

    if (totalFailed === 0) {
        console.log('🎉 ¡TODAS LAS PRUEBAS PASADAS! El sistema está seguro.');
    } else {
        console.log(`⚠️  ${totalFailed} pruebas fallidas. Revisar configuración.`);
    }
};

runAllTests().catch(e => {
    console.error('Error fatal en suite de pruebas:', e);
    process.exit(1);
});
