/**
 * SCRIPT: Verificar estructura de productos
 * Ver exactamente cómo están almacenados los campos de pricing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { Producto } from '../models/Product.js';

async function verificarEstructura() {
  try {
    console.log('\n🔍 Verificando estructura de productos...\n');

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gaddyel';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB\n');

    // Buscar el producto testproducto
    const producto = await Producto.findOne({ nombre: 'testproducto' }).lean();

    if (!producto) {
      console.log('❌ No se encontró el producto "testproducto"\n');
      await mongoose.disconnect();
      return;
    }

    console.log('📦 PRODUCTO: testproducto');
    console.log('='.repeat(60));
    console.log(JSON.stringify(producto, null, 2));
    console.log('='.repeat(60));

    console.log('\n📊 CAMPOS DE PRICING:\n');
    console.log('precioBase (raíz):', producto.precioBase);
    console.log('tasaComisionAplicada (raíz):', producto.tasaComisionAplicada);
    console.log('fechaActualizacionPrecio (raíz):', producto.fechaActualizacionPrecio);
    console.log('\npropiedadesPersonalizadas:', producto.propiedadesPersonalizadas);
    console.log('tipo:', typeof producto.propiedadesPersonalizadas);

    await mongoose.disconnect();
    console.log('\n✅ Verificación completada\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verificarEstructura().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
