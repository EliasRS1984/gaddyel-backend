/**
 * SCRIPT: Migración de Precios - Mover campos de pricing a nivel raíz
 * 
 * PROPÓSITO:
 * 1. Mover precioBase de propiedadesPersonalizadas → nivel raíz
 * 2. Mover tasaComisionAplicada de propiedadesPersonalizadas → nivel raíz
 * 3. Mover fechaActualizacionPrecio de propiedadesPersonalizadas → nivel raíz
 * 4. LIMPIAR estos campos de propiedadesPersonalizadas (deben estar solo a nivel raíz)
 * 5. Si no existe precioBase, calcularlo: precio * (1 - tasaComision)
 * 
 * FLUJO:
 * 1. Conectar a MongoDB
 * 2. Buscar productos con campos de pricing en propiedadesPersonalizadas
 * 3. Para cada producto:
 *    - Mover campos a nivel raíz
 *    - Eliminar de propiedadesPersonalizadas
 *    - Si falta precioBase, calcular
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
import { Producto } from '../models/Product.js';

const TASA_MIGRACION = 0.0761; // Tasa MP estándar

async function migrateProductPricing() {
  try {
    console.log('\n🔄 Iniciando migración de precios...\n');

    // Conectar a BD
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gaddyel';
    console.log('📡 Conectando a MongoDB...\n');
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB\n');

    // PASO 1: Encontrar TODOS los productos para migración completa
    const todosLosProductos = await Producto.find({});
    console.log(`📊 Total de productos a procesar: ${todosLosProductos.length}\n`);

    if (todosLosProductos.length === 0) {
      console.log('✅ No hay productos en la base de datos\n');
      await mongoose.disconnect();
      return;
    }

    // PASO 2: Migrar cada producto
    let migrados = 0;
    let limpiados = 0;
    let errores = [];

    for (const producto of todosLosProductos) {
      try {
        const updateData = {};
        const unsetData = {};
        let necesitaMigracion = false;

        // A. Verificar si precioBase está en propiedadesPersonalizadas
        const propsPrecioBase = producto.propiedadesPersonalizadas?.get('precioBase');
        if (propsPrecioBase !== undefined && propsPrecioBase !== null) {
          updateData.precioBase = parseFloat(propsPrecioBase);
          unsetData['propiedadesPersonalizadas.precioBase'] = '';
          necesitaMigracion = true;
          console.log(`   🔄 Moviendo precioBase desde propiedadesPersonalizadas (${propsPrecioBase})`);
        }

        // B. Verificar si tasaComisionAplicada está en propiedadesPersonalizadas
        const propsTasa = producto.propiedadesPersonalizadas?.get('tasaComisionAplicada');
        if (propsTasa !== undefined && propsTasa !== null) {
          updateData.tasaComisionAplicada = parseFloat(propsTasa);
          unsetData['propiedadesPersonalizadas.tasaComisionAplicada'] = '';
          necesitaMigracion = true;
          console.log(`   🔄 Moviendo tasaComisionAplicada desde propiedadesPersonalizadas`);
        }

        // C. Verificar si fechaActualizacionPrecio está en propiedadesPersonalizadas
        const propsFecha = producto.propiedadesPersonalizadas?.get('fechaActualizacionPrecio');
        if (propsFecha !== undefined && propsFecha !== null) {
          updateData.fechaActualizacionPrecio = new Date(propsFecha);
          unsetData['propiedadesPersonalizadas.fechaActualizacionPrecio'] = '';
          necesitaMigracion = true;
          console.log(`   🔄 Moviendo fechaActualizacionPrecio desde propiedadesPersonalizadas`);
        }

        // D. Si no tiene precioBase a nivel raíz, calcular
        if (!producto.precioBase || producto.precioBase === 0) {
          if (!updateData.precioBase) {
            const precioBase = producto.precio * (1 - TASA_MIGRACION);
            updateData.precioBase = Math.round(precioBase * 100) / 100;
            console.log(`   ➕ Calculando precioBase: $${producto.precio} → $${updateData.precioBase}`);
            necesitaMigracion = true;
          }
        }

        // E. Asegurar tasa y fecha si no existen
        if (!producto.tasaComisionAplicada && !updateData.tasaComisionAplicada) {
          updateData.tasaComisionAplicada = TASA_MIGRACION;
          necesitaMigracion = true;
        }

        if (!producto.fechaActualizacionPrecio && !updateData.fechaActualizacionPrecio) {
          updateData.fechaActualizacionPrecio = new Date();
          necesitaMigracion = true;
        }

        // F. Aplicar cambios si es necesario
        if (necesitaMigracion) {
          const operaciones = { $set: updateData };
          if (Object.keys(unsetData).length > 0) {
            operaciones.$unset = unsetData;
            limpiados++;
          }

          await Producto.findByIdAndUpdate(
            producto._id,
            operaciones,
            { new: true }
          );

          migrados++;
          console.log(`✅ [${migrados}/${todosLosProductos.length}] ${producto.nombre}`);
          if (Object.keys(unsetData).length > 0) {
            console.log(`   🧹 Limpiados ${Object.keys(unsetData).length} campos de propiedadesPersonalizadas`);
          }
          console.log('');
        } else {
          console.log(`⏭️  [${migrados + 1}/${todosLosProductos.length}] ${producto.nombre} - Ya migrado`);
        }

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
    console.log(`🧹 Limpiados de propiedadesPersonalizadas: ${limpiados}`);
    console.log(`❌ Con errores: ${errores.length}`);
    console.log(`📊 Total procesados: ${migrados + errores.length}/${todosLosProductos.length}`);

    if (errores.length > 0) {
      console.log('\n⚠️  Productos con error:');
      errores.forEach(e => {
        console.log(`   - ${e.nombre}: ${e.error}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    // PASO 4: Verificación
    const sinPrecioBase = await Producto.find({ 
      $or: [
        { precioBase: { $exists: false } },
        { precioBase: null },
        { precioBase: 0 }
      ]
    });
    
    // Verificar si aún hay campos en propiedadesPersonalizadas
    const todosLosProductosActualizados = await Producto.find({});
    let conPropiedadesPricing = 0;
    for (const p of todosLosProductosActualizados) {
      const hasPrecioBase = p.propiedadesPersonalizadas?.has('precioBase');
      const hasTasa = p.propiedadesPersonalizadas?.has('tasaComisionAplicada');
      const hasFecha = p.propiedadesPersonalizadas?.has('fechaActualizacionPrecio');
      if (hasPrecioBase || hasTasa || hasFecha) {
        conPropiedadesPricing++;
      }
    }

    if (sinPrecioBase.length === 0 && conPropiedadesPricing === 0) {
      console.log('✅ Verificación exitosa:');
      console.log('   - Todos los productos tienen precioBase a nivel raíz');
      console.log('   - propiedadesPersonalizadas está limpio de campos de pricing\n');
    } else {
      if (sinPrecioBase.length > 0) {
        console.log(`⚠️  ADVERTENCIA: ${sinPrecioBase.length} productos aún sin precioBase\n`);
      }
      if (conPropiedadesPricing > 0) {
        console.log(`⚠️  ADVERTENCIA: ${conPropiedadesPricing} productos aún tienen campos de pricing en propiedadesPersonalizadas\n`);
      }
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
