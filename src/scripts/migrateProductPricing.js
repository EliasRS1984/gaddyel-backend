/**
 * SCRIPT: Migración de Precios - Agregar precioBase a productos existentes
 * 
 * PROPÓSITO:
 * - Calcular precioBase para todos los productos que NO lo tengan
 * - Usar fórmula inversa: precioBase = precio * (1 - tasaComision)
 * - Registrar auditoría de la migración
 * 
 * FLUJO:
 * 1. Conectar a MongoDB
 * 2. Buscar productos sin precioBase (o con precioBase === 0)
 * 3. Para cada producto:
 *    - Calcular: precioBase = precio * (1 - 0.0761)
 *    - Actualizar documento
 * 4. Registrar resumen (productos migrados, errores)
 * 5. Desconectar
 * 
 * EJECUCIÓN:
 * node src/scripts/migrateProductPricing.js
 * 
 * ⚠️ IMPORTANTE: Hacer backup antes de ejecutar
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Importar modelo
import Product from '../models/Product.js';

const TASA_MIGRACION = 0.0761; // Tasa MP estándar

async function migrateProductPricing() {
  try {
    console.log('\n🔄 Iniciando migración de precios...\n');

    // Conectar a BD
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gaddyel';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB\n');

    // PASO 1: Encontrar productos sin precioBase
    const productosParaMigrar = await Product.find({
      $or: [
        { precioBase: { $exists: false } },
        { precioBase: null },
        { precioBase: 0 }
      ]
    });

    console.log(`📊 Productos encontrados sin precioBase: ${productosParaMigrar.length}\n`);

    if (productosParaMigrar.length === 0) {
      console.log('✅ No hay productos para migrar\n');
      await mongoose.disconnect();
      return;
    }

    // PASO 2: Migrar cada producto
    let migrados = 0;
    let errores = [];

    for (const producto of productosParaMigrar) {
      try {
        // Fórmula inversa: precioBase = precio * (1 - tasa)
        const precioBase = producto.precio * (1 - TASA_MIGRACION);
        const precioBaseRedondeado = Math.round(precioBase * 100) / 100;

        // Actualizar documento
        await Product.findByIdAndUpdate(
          producto._id,
          {
            precioBase: precioBaseRedondeado,
            tasaComisionAplicada: TASA_MIGRACION,
            fechaActualizacionPrecio: new Date()
          },
          { new: true }
        );

        migrados++;
        console.log(`✅ [${migrados}/${productosParaMigrar.length}] ${producto.nombre}`);
        console.log(`   Precio: $${producto.precio} → Base: $${precioBaseRedondeado}\n`);

      } catch (error) {
        errores.push({
          productoId: producto._id,
          nombre: producto.nombre,
          error: error.message
        });
        console.error(`❌ Error en ${producto.nombre}: ${error.message}\n`);
      }
    }

    // PASO 3: Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Migrados exitosamente: ${migrados}`);
    console.log(`❌ Con errores: ${errores.length}`);
    console.log(`📊 Total procesados: ${migrados + errores.length}/${productosParaMigrar.length}`);

    if (errores.length > 0) {
      console.log('\n⚠️  Productos con error:');
      errores.forEach(e => {
        console.log(`   - ${e.nombre}: ${e.error}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // PASO 4: Verificación
    const productosVerificacion = await Product.find({ precioBase: { $eq: 0 } });
    if (productosVerificacion.length === 0) {
      console.log('✅ Verificación exitosa: Todos los productos tienen precioBase\n');
    } else {
      console.log(`⚠️  ADVERTENCIA: ${productosVerificacion.length} productos aún sin precioBase\n`);
    }

    // Desconectar
    await mongoose.disconnect();
    console.log('✅ Migración completada\n');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

// Ejecutar
migrateProductPricing().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
