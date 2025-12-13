/**
 * DEBUG SCRIPT: Verificar estado de usuario registrado
 * Ejecutar en backend para diagnosticar por qué falla el login
 */

import Client from './src/models/Client.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function debugUsuario() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Buscar usuario de prueba
        const email = 'tester03@gmail.com';
        console.log(`\n🔍 Buscando usuario: ${email}`);

        // Búsqueda normal (sin password)
        const clienteSinPassword = await Client.findOne({ email });
        console.log('\n📋 Usuario SIN select(+password):');
        console.log(JSON.stringify(clienteSinPassword, null, 2));

        // Búsqueda con password
        const clienteConPassword = await Client.findOne({ email }).select('+password');
        console.log('\n🔐 Usuario CON select(+password):');
        console.log({
            _id: clienteConPassword?._id,
            nombre: clienteConPassword?.nombre,
            email: clienteConPassword?.email,
            whatsapp: clienteConPassword?.whatsapp,
            tienePassword: !!clienteConPassword?.password,
            passwordLength: clienteConPassword?.password?.length,
            passwordComienzoFin: clienteConPassword?.password ? 
                `${clienteConPassword.password.substring(0, 10)}...${clienteConPassword.password.substring(-10)}` : 
                'NO EXISTE',
            domicilio: clienteConPassword?.domicilio,
            localidad: clienteConPassword?.localidad,
            provincia: clienteConPassword?.provincia,
            codigoPostal: clienteConPassword?.codigoPostal,
            createdAt: clienteConPassword?.createdAt,
            updatedAt: clienteConPassword?.updatedAt
        });

        if (!clienteConPassword?.password) {
            console.log('\n⚠️  ERROR ENCONTRADO: El usuario NO TIENE PASSWORD');
            console.log('Esto causa que bcrypt.compare() falle en el login');
            console.log('\nSOLUCIÓN: El usuario debe re-registrarse');
        } else {
            console.log('\n✅ El usuario SÍ tiene password guardado');
        }

        // Listar todos los usuarios
        const todosLosUsuarios = await Client.find({}, { password: 0 });
        console.log(`\n👥 Total de usuarios: ${todosLosUsuarios.length}`);
        todosLosUsuarios.forEach(u => {
            console.log(`  - ${u.email} (${u.nombre})`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Desconectado de MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

debugUsuario();
