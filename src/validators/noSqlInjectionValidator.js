/**
 * Validadores contra NoSQL Injection
 * Previene ataques usando operadores MongoDB maliciosos
 * ✅ SOLUCIÓN: Validación estricta de ObjectIds y campos
 */

import { isValidObjectId } from 'mongoose';

/**
 * Valida que un valor sea ObjectId válido de MongoDB
 * Previene: db.col.find({ _id: { $ne: null } })
 * 
 * @param {string} value - Valor a validar
 * @param {string} fieldName - Nombre del campo (para mensajes de error)
 * @returns {string} Valor validado
 * @throws {Error} Si el valor no es ObjectId válido
 */
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

/**
 * Valida array de ObjectIds
 * 
 * @param {Array} arr - Array de IDs a validar
 * @param {string} fieldName - Nombre del campo
 * @returns {Array} Array de IDs validados
 * @throws {Error} Si algún ID no es válido
 */
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

/**
 * Valida que un objeto solo contenga campos seguros
 * Previene: { nombre: { $set: ... } }
 * 
 * @param {Object} obj - Objeto a validar
 * @param {Array<string>} allowedFields - Campos permitidos
 * @returns {Object} Objeto validado
 * @throws {Error} Si contiene campos no permitidos u operadores MongoDB
 */
export const validateObjectFields = (obj, allowedFields) => {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('Parámetro debe ser objeto');
    }

    const keys = Object.keys(obj);
    
    // Rechazar operadores MongoDB
    const mongoOperators = ['$set', '$inc', '$push', '$pull', '$ne', '$eq', '$where', '$regex', '$gt', '$lt'];
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
