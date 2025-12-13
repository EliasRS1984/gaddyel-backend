/**
 * Herramienta de diagnóstico para DELETE /api/pedidos/:id
 * Ejecutar: node diagnose-delete.js
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import AdminUser from './src/models/AdminUser.js';
import dotenv from 'dotenv';

dotenv.config();

async function diagnose() {
    console.log('\n========== DIAGNÓSTICO DELETE /api/pedidos/:id ==========\n');

    try {
        // 1. Conectar a MongoDB
        console.log('1. Conectando a MongoDB...');
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gaddyel';
        await mongoose.connect(mongoUri);
        console.log('✅ Conectado a MongoDB\n');

        // 2. Buscar usuarios admin
        console.log('2. Buscando usuarios AdminUser en la BD...');
        const admins = await AdminUser.find().select('email name role isActive');
        if (admins.length === 0) {
            console.log('❌ NO hay usuarios AdminUser en la BD');
            console.log('   Necesitas crear al menos un admin. Ejecuta el endpoint /api/seed\n');
        } else {
            console.log(`✅ Encontrados ${admins.length} usuarios AdminUser:`);
            admins.forEach((admin, i) => {
                console.log(`   ${i + 1}. Email: ${admin.email}, Role: ${admin.role}, Activo: ${admin.isActive}`);
            });
            console.log();
        }

        // 3. Simular creación de token
        if (admins.length > 0) {
            console.log('3. Simulando creación de token JWT...');
            const admin = admins[0];
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            const token = jwt.sign(
                { userId: admin._id, email: admin.email, role: admin.role },
                secret,
                { expiresIn: '7d' }
            );
            console.log(`✅ Token creado para: ${admin.email}`);
            console.log(`   Token: ${token.substring(0, 50)}...`);
            console.log();

            // 4. Decodificar token
            console.log('4. Decodificando token...');
            try {
                const decoded = jwt.verify(token, secret);
                console.log('✅ Token válido. Datos:');
                console.log(`   userId: ${decoded.userId}`);
                console.log(`   email: ${decoded.email}`);
                console.log(`   role: ${decoded.role}`);
                console.log();

                // 5. Buscar admin por userId
                console.log('5. Buscando AdminUser por userId en la BD...');
                const foundAdmin = await AdminUser.findById(decoded.userId);
                if (!foundAdmin) {
                    console.log('❌ AdminUser NO encontrado por userId');
                    console.log(`   userId usado: ${decoded.userId}`);
                    console.log(`   Esto causará 403: "Admin no encontrado"\n`);
                } else {
                    console.log('✅ AdminUser encontrado:');
                    console.log(`   Email: ${foundAdmin.email}`);
                    console.log(`   Activo: ${foundAdmin.isActive}`);
                    console.log(`   Role: ${foundAdmin.role}`);
                    console.log();

                    // 6. Verificar método comparePassword
                    console.log('6. Verificando método comparePassword...');
                    if (typeof foundAdmin.comparePassword !== 'function') {
                        console.log('❌ Método comparePassword NO existe en el documento');
                        console.log('   Esto causará error: "admin.comparePassword is not a function"\n');
                    } else {
                        console.log('✅ Método comparePassword existe');
                        console.log();

                        // 7. Probar comparePassword con contraseña de prueba
                        console.log('7. Para probar comparePassword, necesitas la contraseña real del admin.');
                        console.log('   Cuando loguearse, la contraseña se hashea con bcrypt.');
                        console.log('   No es posible extraer la contraseña original de la BD.\n');
                    }
                }
            } catch (error) {
                console.log('❌ Error decodificando token:', error.message);
            }
        }

        // 8. Resumen
        console.log('========== RESUMEN DEL DIAGNÓSTICO ==========');
        console.log('\nPosibles causas del error 403:\n');
        console.log('1. ❓ Token no se envía en header Authorization');
        console.log('   Solución: Verificar en DevTools > Network > DELETE request > Headers\n');
        console.log('2. ❓ Token es inválido o expirado');
        console.log('   Solución: Login de nuevo para obtener token nuevo\n');
        console.log('3. ❓ AdminUser no existe en BD');
        console.log('   Solución: Crear admin con /api/seed\n');
        console.log('4. ❓ AdminUser está inactivo (isActive = false)');
        console.log('   Solución: Activar admin en BD\n');
        console.log('5. ❓ Contraseña incorrecta');
        console.log('   Solución: Revisar que teclado esté correcto, considera Caps Lock\n');
        console.log('6. ❓ CORS issue (preflight OPTIONS fallido)');
        console.log('   Solución: Revisar consola servidor por mensajes de CORS\n');

    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Desconectado de MongoDB\n');
    }
}

diagnose();
