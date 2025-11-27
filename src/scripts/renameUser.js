import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

async function renameUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');
        
        const usuarioActual = 'testadmin';
        const usuarioNuevo = 'Elias';
        const password = 'Callao1929';
        
        console.log(`🔄 Renombrando usuario de "${usuarioActual}" a "${usuarioNuevo}"`);
        
        // Primero verificar si el nuevo usuario ya existe
        const existe = await Admin.findOne({ usuario: usuarioNuevo });
        if (existe) {
            console.log(`❌ El usuario "${usuarioNuevo}" ya existe en la base de datos`);
            process.exit(1);
        }
        
        // Actualizar el usuario
        const result = await Admin.findOneAndUpdate(
            { usuario: usuarioActual },
            { usuario: usuarioNuevo },
            { new: true }
        );
        
        if (result) {
            console.log('✅ Usuario renombrado correctamente');
            console.log(`📝 Nuevo usuario: ${usuarioNuevo}`);
            console.log(`🔑 Contraseña: ${password}`);
            console.log('\n✨ Ya puedes usar estas credenciales para hacer login');
        } else {
            console.log(`❌ Usuario "${usuarioActual}" no encontrado`);
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

renameUser();
