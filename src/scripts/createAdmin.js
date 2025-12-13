#!/usr/bin/env node

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Crear admin de prueba
        const usuario = 'Elias';
        const password = 'Callao1929';

        // Verificar si existe
        const exists = await Admin.findOne({ usuario });
        if (exists) {
            console.log(`⚠️ Admin "${usuario}" ya existe`);
            return;
        }

        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear admin
        const admin = new Admin({
            usuario,
            password: hashedPassword
        });

        await admin.save();
        console.log('✅ Admin creado:');
        console.log(`   Usuario: ${usuario}`);
        console.log(`   Contraseña: ${password}`);
        console.log('\n⚠️ IMPORTANTE: Cambia la contraseña después del primer login');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

createAdmin();
