/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Funciones que bloquean intentos de inyección NoSQL.
 * Un atacante podría enviar operadores de MongoDB
 * (como $ne, $or, $where) para manipular las consultas
 * a la base de datos. Estas funciones los detectan y rechazan.
 *
 * ¿CÓMO FUNCIONA?
 * 1. validateObjectId() verifica que un ID sea un ObjectId
 *    válido de MongoDB antes de usarlo en una consulta.
 * 2. validateObjectFields() revisa que un objeto no contenga
 *    operadores MongoDB prohibidos.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error 'Operador MongoDB no permitido'? → Alguien envía
 *   datos maliciosos. Revisar el origen de la solicitud.
 * - ¿Error 'ObjectId no válido'? → El ID en la URL o en el
 *   cuerpo de la solicitud tiene formato incorrecto.
 * ======================================================
 */

import { isValidObjectId } from 'mongoose';

// ======== VALIDAR ID DE MONGODB ========
// Verifica que el valor sea un ObjectId válido antes de usarlo en una consulta.
export const validateObjectId = (value, fieldName = 'ID') => {
    if (!value) {
        throw new Error(`${fieldName} es requerido`);
    }

    if (typeof value !== 'string') {
        throw new Error(`${fieldName} debe ser string, recibido: ${typeof value}`);
    }

    if (!isValidObjectId(value)) {
        throw new Error(`${fieldName} no es un ObjectId válido`);
    }

    return value;
};

// ======== VALIDAR ARRAY DE IDs ========
// Verifica que cada elemento del array sea un ObjectId válido.
export const validateObjectIdArray = (arr, fieldName = 'IDs') => {
    if (!Array.isArray(arr)) {
        throw new Error(`${fieldName} debe ser un array`);
    }

    return arr.map((id, idx) => {
        try {
            return validateObjectId(id, `${fieldName}[${idx}]`);
        } catch (error) {
            throw new Error(`${fieldName}[${idx}]: ${error.message}`);
        }
    });
};

// ======== VALIDAR CAMPOS DE UN OBJETO ========
// Verifica que el objeto no tenga operadores MongoDB y solo contenga
// los campos que se esperan.
export const validateObjectFields = (obj, allowedFields) => {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('Parámetro debe ser objeto');
    }

    const keys = Object.keys(obj);
    
    // Lista completa de operadores MongoDB conocidos como peligrosos.
    // Cualquier clave en el objeto que coincida con alguno de estos será rechazada.
    const mongoOperators = [
        '$set', '$inc', '$push', '$pull', '$ne', '$eq', '$where', '$regex', '$gt', '$lt',
        '$or', '$and', '$in', '$nin', '$exists', '$text', '$nor', '$not', '$mod',
        '$all', '$elemMatch', '$size', '$unset', '$rename', '$addToSet', '$pop', '$bit'
    ];
    for (const key of keys) {
        if (mongoOperators.some(op => key.includes(op))) {
            throw new Error(`Operador MongoDB no permitido: ${key}`);
        }
    }

    // Validar que solo tenga campos permitidos
    const invalidFields = keys.filter(k => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
        throw new Error(`Campos no permitidos: ${invalidFields.join(', ')}`);
    }

    return obj;
};

export default {
    validateObjectId,
    validateObjectIdArray,
    validateObjectFields
};
