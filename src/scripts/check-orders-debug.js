import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order.js';

dotenv.config();

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB\n');

        // Obtener TODAS las órdenes (sin filtros)
        const allOrders = await Order.find({})
            .select('orderNumber estadoPago estadoPedido createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        console.log('📊 ÚLTIMAS 10 ÓRDENES EN LA BASE DE DATOS:');
        console.log('================================================\n');

        allOrders.forEach((order, index) => {
            console.log(`${index + 1}. ${order.orderNumber || 'SIN CÓDIGO'}`);
            console.log(`   Estado Pago: "${order.estadoPago}" (tipo: ${typeof order.estadoPago})`);
            console.log(`   Estado Pedido: "${order.estadoPedido}"`);
            console.log(`   Creado: ${order.createdAt}`);
            console.log('');
        });

        // Contar por estado
        const countByStatus = await Order.aggregate([
            { $group: { _id: '$estadoPago', count: { $sum: 1 } } }
        ]);

        console.log('📈 CONTEO POR ESTADO DE PAGO:');
        countByStatus.forEach(item => {
            console.log(`   ${item._id || 'NULL/UNDEFINED'}: ${item.count}`);
        });

        // Verificar específicamente las 3 órdenes
        console.log('\n🔍 VERIFICANDO LAS 3 ÓRDENES MENCIONADAS:');
        const specificOrders = await Order.find({
            orderNumber: { $in: ['G-92B058', 'G-593758', 'G-E095B8'] }
        });

        specificOrders.forEach(order => {
            console.log(`\n${order.orderNumber}:`);
            console.log(`   estadoPago: "${order.estadoPago}"`);
            console.log(`   estadoPedido: "${order.estadoPedido}"`);
            console.log(`   payment.mercadoPago.status: "${order.payment?.mercadoPago?.status || 'N/A'}"`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Desconectado');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkOrders();
