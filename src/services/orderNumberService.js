/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Este archivo genera números de pedido secuenciales y únicos
 * en formato G-001, G-002, etc. (G = Gaddyel).
 *
 * ¿CÓMO FUNCIONA?
 * 1. Se guarda un contador en la base de datos.
 * 2. Cada vez que llega un pedido nuevo, el contador sube en 1
 *    de forma atómica (no pueden generarse dos números iguales).
 * 3. El número se formatea con ceros a la izquierda: G-001.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Se generan números duplicados? → El contador de MongoDB usa
 *   $inc atómico; si hay duplicados revisar la conexión a la base de datos.
 * - ¿GetNextOrderNumber falla? → Verificar que la colección 'counters'
 *   exista en la base de datos.
 * ======================================================
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// Esquema del contador — guarda un número que sube con cada pedido nuevo
const counterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    sequence_value: {
        type: Number,
        default: 0
    }
});

const Counter = mongoose.model('Counter', counterSchema);

// ======== GENERAR SIGUIENTE NÚMERO ========
// Sube el contador en 1 y devuelve el número formateado.
// Ejemplo: G-001, G-002, …
export async function getNextOrderNumber() {
    try {
        const counter = await Counter.findByIdAndUpdate(
            'order_number',
            { $inc: { sequence_value: 1 } },
            { 
                new: true, 
                upsert: true // Crea el contador si no existe aún
            }
        );
        
        const paddedNumber = String(counter.sequence_value).padStart(3, '0');
        return `G-${paddedNumber}`;
    } catch (error) {
        logger.error('Error al generar número de orden', { message: error.message });
        throw new Error('No se pudo generar el número de orden');
    }
}

// ======== CONSULTAR NÚMERO ACTUAL ========
// Lee el contador sin modificarlo.
export async function getCurrentOrderNumber() {
    try {
        const counter = await Counter.findById('order_number');
        if (!counter) {
            return 'G-000';
        }
        const paddedNumber = String(counter.sequence_value).padStart(3, '0');
        return `G-${paddedNumber}`;
    } catch (error) {
        logger.error('Error al obtener número de orden actual', { message: error.message });
        throw new Error('No se pudo obtener el número de orden actual');
    }
}

// ======== REINICIAR CONTADOR ========
// Vuelve el contador a cero. Solo para pruebas o migraciones.
export async function resetOrderNumber() {
    try {
        await Counter.findByIdAndUpdate(
            'order_number',
            { sequence_value: 0 },
            { upsert: true }
        );
        return 'G-000';
    } catch (error) {
        logger.error('Error al reiniciar contador de orden', { message: error.message });
        throw new Error('No se pudo reiniciar el contador');
    }
}

// ======== FIJAR CONTADOR MANUALMENTE ========
// Establece el contador a un valor específico. Solo para migraciones.
export async function setOrderNumber(number) {
    try {
        const counter = await Counter.findByIdAndUpdate(
            'order_number',
            { sequence_value: number },
            { upsert: true, new: true }
        );
        const paddedNumber = String(counter.sequence_value).padStart(6, '0');
        return `#${paddedNumber}`;
    } catch (error) {
        logger.error('Error al establecer número de orden', { message: error.message });
        throw new Error('No se pudo establecer el número de orden');
    }
}

export default {
    getNextOrderNumber,
    getCurrentOrderNumber,
    resetOrderNumber,
    setOrderNumber
};
