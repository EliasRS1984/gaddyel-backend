/**
 * Generación de firmas seguras para Cloudinary
 * NUNCA exponer API_SECRET en cliente
 * ✅ SOLUCIÓN: Firmas generadas en servidor usando API Secret
 */

import crypto from 'crypto';

/**
 * Genera firma segura de Cloudinary en servidor
 * Validar siempre en backend, NUNCA exponer API_SECRET
 * 
 * @param {Object} params - Parámetros adicionales para la firma
 * @returns {Object} Objeto con timestamp, signature, apiKey, folder
 */
export const generateCloudinarySignature = (params = {}) => {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // ✅ IMPORTANTE: Cloudinary solo requiere `timestamp` en la firma
    // NO incluir folder, quality, fetch_format, etc. en la firma
    // La firma se calcula como: sha256(timestamp + API_SECRET)
    const signableString = `timestamp=${timestamp}`;
    
    // Generar firma con SHA-256
    const signature = crypto
        .createHash('sha256')
        .update(signableString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');
    
    const folder = params.folder || process.env.CLOUDINARY_FOLDER || 'Gaddyel-Productos';
    
    return {
        timestamp,
        signature,
        folder,
        apiKey: process.env.CLOUDINARY_API_KEY, // ✅ Solo API_KEY, NO SECRET
        cloudName: process.env.CLOUDINARY_CLOUD_NAME
    };
};

/**
 * Verifica firma de Cloudinary en webhook
 * Usa comparación timing-safe para prevenir timing attacks
 * 
 * @param {Object} params - Parámetros recibidos
 * @param {string} signature - Firma a verificar
 * @returns {boolean} true si la firma es válida
 */
export const verifyCloudinarySignature = (params, signature) => {
    // Mismo algoritmo que generateCloudinarySignature
    const signableParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
    
    const expectedSignature = crypto
        .createHash('sha256')
        .update(signableParams + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');
    
    // Comparación timing-safe
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};

export default {
    generateCloudinarySignature,
    verifyCloudinarySignature
};
