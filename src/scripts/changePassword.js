import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import Admin from '../models/Admin.js';

dotenv.config();

async function changePassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');
        
        const usuario = 'Elias';
        const newPassword = 'Callao1929';
        
        console.log(`🔄 Cambiando contraseña para usuario: ${usuario}`);
        
        const hash = await bcryptjs.hash(newPassword, 10);
        const result = await Admin.findOneAndUpdate(
            { usuario },
            { password: hash },
            { new: true }
        );
        
        if (result) {
            console.log('✅ Contraseña actualizada correctamente');
            console.log(`📝 Usuario: ${usuario}`);
            console.log(`🔑 Contraseña: ${newPassword}`);
        } else {
            console.log('❌ Usuario no encontrado. ¿Existe "testadmin"?');
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

changePassword();
