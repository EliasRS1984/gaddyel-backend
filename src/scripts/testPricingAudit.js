/**
 * 🧪 Script de Prueba - Auditoría de Pricing
 * 
 * PROPÓSITO:
 * Verificar que los campos de auditoría se calculan y guardan correctamente:
 * - precioCalculadoExacto: Precio antes de redondeo
 * - ajusteRedondeo: Diferencia por redondeo comercial
 * - montoComision: Comisión de Mercado Pago
 * 
 * USO:
 * node src/scripts/testPricingAudit.js
 */

import mongoose from 'mongoose';
import Producto from '../models/Product.js';
import SystemConfig from '../models/SystemConfig.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function testPricingAudit() {
    try {
        console.log('🔌 Conectando a MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado\n');

        // Obtener configuración actual
        const config = await SystemConfig.obtenerConfigActual();
        const tasaComision = config.comisiones.mercadoPago.tasaComision;
        
        console.log(`📊 Tasa de comisión actual: ${(tasaComision * 100).toFixed(2)}%\n`);

        // ====================================
        // PRUEBA 1: Crear producto nuevo
        // ====================================
        console.log('📦 PRUEBA 1: Crear producto con precioBase = 110000');
        console.log('─'.repeat(60));
        
        const precioBase = 110000;
        const breakdown = await config.calcularPrecioVenta(precioBase);
        
        console.log('Cálculo realizado:');
        console.log(`  Precio Base: $${precioBase}`);
        console.log(`  Precio Exacto: $${breakdown.precioExacto.toFixed(2)}`);
        console.log(`  Precio Final: $${breakdown.precioVenta}`);
        console.log(`  Ajuste Redondeo: $${breakdown.ajusteRedondeo.toFixed(2)}`);
        console.log(`  Comisión MP: $${breakdown.montoComision.toFixed(2)}`);
        console.log(`  Tasa Aplicada: ${(breakdown.tasaAplicada * 100).toFixed(2)}%\n`);

        const productoTest = new Producto({
            nombre: '🧪 TEST - Producto Auditoría',
            descripcion: 'Producto de prueba para verificar auditoría de pricing',
            categoria: 'Test',
            material: 'Test Material',
            cantidadUnidades: 100,
            precioBase: precioBase,
            precio: breakdown.precioVenta,
            precioCalculadoExacto: breakdown.precioExacto,
            ajusteRedondeo: breakdown.ajusteRedondeo,
            montoComision: breakdown.montoComision,
            tasaComisionAplicada: breakdown.tasaAplicada,
            fechaActualizacionPrecio: new Date(),
            imagenes: [],
            destacado: false
        });

        await productoTest.save();
        console.log(`✅ Producto creado con ID: ${productoTest._id}`);

        // Verificar que se guardó correctamente
        const verificado = await Producto.findById(productoTest._id);
        console.log('\n🔍 Verificación de campos guardados:');
        console.log(`  precioBase: $${verificado.precioBase}`);
        console.log(`  precio: $${verificado.precio}`);
        console.log(`  precioCalculadoExacto: $${verificado.precioCalculadoExacto?.toFixed(2) || 'NO GUARDADO'}`);
        console.log(`  ajusteRedondeo: $${verificado.ajusteRedondeo?.toFixed(2) || 'NO GUARDADO'}`);
        console.log(`  montoComision: $${verificado.montoComision?.toFixed(2) || 'NO GUARDADO'}`);
        console.log(`  tasaComisionAplicada: ${verificado.tasaComisionAplicada ? (verificado.tasaComisionAplicada * 100).toFixed(2) + '%' : 'NO GUARDADO'}`);

        // ====================================
        // PRUEBA 2: Validar matemática
        // ====================================
        console.log('\n\n📐 PRUEBA 2: Validación Matemática');
        console.log('─'.repeat(60));
        
        const precioFinal = verificado.precio;
        const precioExactoCalculado = precioBase / (1 - tasaComision);
        const ajusteEsperado = precioFinal - precioExactoCalculado;
        const comisionEsperada = precioFinal - precioBase;
        
        console.log('Valores esperados:');
        console.log(`  Precio Exacto: $${precioExactoCalculado.toFixed(2)}`);
        console.log(`  Precio Final: $${precioFinal}`);
        console.log(`  Ajuste Redondeo: $${ajusteEsperado.toFixed(2)}`);
        console.log(`  Comisión: $${comisionEsperada.toFixed(2)}`);
        
        console.log('\nComparación:');
        const matchExacto = Math.abs(verificado.precioCalculadoExacto - precioExactoCalculado) < 0.01;
        const matchAjuste = Math.abs(verificado.ajusteRedondeo - ajusteEsperado) < 0.01;
        const matchComision = Math.abs(verificado.montoComision - comisionEsperada) < 0.01;
        
        console.log(`  Precio Exacto: ${matchExacto ? '✅' : '❌'} ${matchExacto ? 'CORRECTO' : 'ERROR'}`);
        console.log(`  Ajuste Redondeo: ${matchAjuste ? '✅' : '❌'} ${matchAjuste ? 'CORRECTO' : 'ERROR'}`);
        console.log(`  Comisión: ${matchComision ? '✅' : '❌'} ${matchComision ? 'CORRECTO' : 'ERROR'}`);

        // ====================================
        // PRUEBA 3: Verificar transparencia contable
        // ====================================
        console.log('\n\n💰 PRUEBA 3: Transparencia Contable');
        console.log('─'.repeat(60));
        
        const netoRecibido = precioFinal - verificado.montoComision;
        const diferenciaConBase = netoRecibido - precioBase;
        
        console.log('Análisis contable:');
        console.log(`  Precio de Venta Final: $${precioFinal}`);
        console.log(`  - Comisión MP: -$${verificado.montoComision.toFixed(2)}`);
        console.log(`  = Neto Recibido: $${netoRecibido.toFixed(2)}`);
        console.log(`  Precio Base Objetivo: $${precioBase}`);
        console.log(`  Diferencia: $${diferenciaConBase.toFixed(2)}`);
        
        if (Math.abs(diferenciaConBase) < 1) {
            console.log('\n✅ El neto recibido está dentro del margen esperado (<$1)');
        } else {
            console.log(`\n⚠️ Hay una diferencia de $${diferenciaConBase.toFixed(2)} con el precio base`);
        }

        // ====================================
        // LIMPIEZA
        // ====================================
        console.log('\n\n🧹 Limpiando producto de prueba...');
        await Producto.findByIdAndDelete(productoTest._id);
        console.log('✅ Producto eliminado\n');

        console.log('═'.repeat(60));
        console.log('✅ TODAS LAS PRUEBAS COMPLETADAS');
        console.log('═'.repeat(60));

    } catch (error) {
        console.error('\n❌ Error en pruebas:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Desconectado de MongoDB');
    }
}

// Ejecutar pruebas
testPricingAudit();
