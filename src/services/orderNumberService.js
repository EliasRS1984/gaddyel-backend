import mongoose from 'mongoose';

/**
 * Servicio para generar números de orden secuenciales
 * Usa una colección separada para mantener contadores atómicos
 */

// Schema para el contador
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

/**
 * Genera el próximo número de orden único
 * Formato simplificado: G-001, G-002, etc.
 * G = Gaddyel
 */
export async function getNextOrderNumber() {
    try {
        const counter = await Counter.findByIdAndUpdate(
            'order_number',
            { $inc: { sequence_value: 1 } },
            { 
                new: true, 
                upsert: true // Crea el contador si no existe
            }
        );
        
        // Formato simplificado con 3 dígitos
        const paddedNumber = String(counter.sequence_value).padStart(3, '0');
        return `G-${paddedNumber}`;
    } catch (error) {
        console.error('Error al generar número de orden:', error);
        throw new Error('No se pudo generar el número de orden');
    }
}

/**
 * Obtiene el contador actual sin incrementar
 */
export async function getCurrentOrderNumber() {
    try {
        const counter = await Counter.findById('order_number');
        if (!counter) {
            return '#000000';
        }
        const paddedNumber = String(counter.sequence_value).padStart(6, '0');
        return `#${paddedNumber}`;
    } catch (error) {
        console.error('Error al obtener número de orden:', error);
        throw new Error('No se pudo obtener el número de orden actual');
    }
}

/**
 * Reinicia el contador (para pruebas o migración)
 */
export async function resetOrderNumber() {
    try {
        await Counter.findByIdAndUpdate(
            'order_number',
            { sequence_value: 0 },
            { upsert: true }
        );
        return '#000000';
    } catch (error) {
        console.error('Error al reiniciar contador:', error);
        throw new Error('No se pudo reiniciar el contador');
    }
}

/**
 * Establece manualmente el contador a un valor específico
 */
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
        console.error('Error al establecer número de orden:', error);
        throw new Error('No se pudo establecer el número de orden');
    }
}

export default {
    getNextOrderNumber,
    getCurrentOrderNumber,
    resetOrderNumber,
    setOrderNumber
};
