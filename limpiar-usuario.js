/**
 * SCRIPT: Eliminar usuario problemático e iniciar registro limpio
 */

import Client from './src/models/Client.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function limpiarUsuario() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        const email = 'tester03@gmail.com';
        console.log(`🗑️  Buscando usuario: ${email}`);

        const usuarioExistente = await Client.findOne({ email });
        
        if (usuarioExistente) {
            console.log(`✅ Usuario encontrado: ${usuarioExistente.nombre}`);
            console.log(`   ID: ${usuarioExistente._id}`);
            
            const resultado = await Client.deleteOne({ email });
            console.log(`\n✅ Usuario eliminado correctamente`);
            console.log(`   Documentos deletados: ${resultado.deletedCount}`);
        } else {
            console.log(`❌ Usuario no encontrado`);
        }

        // Listar usuarios restantes
        const usuarios = await Client.find({}, { email: 1, nombre: 1, password: 0 });
        console.log(`\n👥 Usuarios restantes (${usuarios.length}):`);
        usuarios.forEach(u => {
            console.log(`   - ${u.email} (${u.nombre})`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Desconectado de MongoDB');
        console.log('\n💡 El usuario debe registrarse nuevamente');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

limpiarUsuario();
