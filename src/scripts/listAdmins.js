import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

async function listAdmins() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');
        
        const admins = await Admin.find({}, { password: 0 });
        
        if (admins.length === 0) {
            console.log('❌ No hay usuarios admin en la base de datos');
        } else {
            console.log(`\n📋 Usuarios admin encontrados (${admins.length}):\n`);
            admins.forEach((admin, index) => {
                console.log(`${index + 1}. ${admin.usuario} (ID: ${admin._id})`);
            });
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

listAdmins();
