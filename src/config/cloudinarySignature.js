/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Herramientas para generar y verificar firmas digitales de Cloudinary.
 * Una "firma" es un código matemático que le demuestra a Cloudinary
 * que la orden de subir una imagen vino realmente de nuestro servidor,
 * y no de alguien que interceptó la petición.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El servidor recibe una solicitud de subida de imagen
 * 2. generateCloudinarySignature() crea un código único combinando
 *    los parámetros del upload con el secreto de la cuenta
 * 3. Ese código viaja al navegador junto con los datos de la imagen
 * 4. El navegador envía todo a Cloudinary, que verifica el código
 * 5. Si el código no coincide, Cloudinary rechaza la subida
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Cloudinary rechaza el upload con "Invalid signature"?
 *   → Verificar que la carpeta de destino coincida en el body del upload
 *     y en los parámetros firmados
 * - ¿Error en verifyCloudinarySignature? → Revisar que los parámetros
 *   del webhook estén ordenados alfabéticamente antes de verificar
 * - Documentación oficial: https://cloudinary.com/documentation/upload_images#authenticated_requests
 * ======================================================
 */

import crypto from 'crypto';

// ======== GENERACIÓN DE FIRMA PARA SUBIDA DE IMÁGENES ========
// Esta función crea el código de verificación que autoriza una subida.
// IMPORTANTE: Todos los parámetros que se envían a Cloudinary deben
// estar incluidos en la firma. Si se firma solo una parte, Cloudinary
// rechaza el upload porque los parámetros no coinciden.
// Referencia: https://cloudinary.com/documentation/upload_images#authenticated_requests
export const generateCloudinarySignature = (params = {}) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = params.folder || process.env.CLOUDINARY_FOLDER || 'Gaddyel-Productos';

    // Construir el conjunto de parámetros que se van a firmar.
    // Estos mismos parámetros deben enviarse al hacer el upload.
    // Parámetros excluidos de la firma (según docs de Cloudinary):
    // file, api_key, resource_type, cloud_name
    const signableParams = {
        folder,
        timestamp,
        ...params.extra // Parámetros adicionales opcionales (transformation, etc.)
    };

    // Ordenar alfabéticamente y concatenar como "clave=valor&clave=valor"
    const signableString = Object.keys(signableParams)
        .sort()
        .map(key => `${key}=${signableParams[key]}`)
        .join('&');

    // Generar la firma combinando los parámetros con el secreto de la cuenta
    const signature = crypto
        .createHash('sha256')
        .update(signableString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

    return {
        timestamp,
        signature,
        folder,
        apiKey:    process.env.CLOUDINARY_API_KEY,   // Solo la clave pública, nunca el secreto
        cloudName: process.env.CLOUDINARY_CLOUD_NAME
    };
};

// ======== VERIFICACIÓN DE FIRMA EN NOTIFICACIONES DE CLOUDINARY ========
// Cuando Cloudinary nos avisa que una imagen fue procesada, esta función
// verifica que el aviso realmente vino de Cloudinary y no de un tercero.
// Usa comparación en tiempo constante para evitar ataques de timing.
export const verifyCloudinarySignature = (params, signature) => {
    // Ordenar parámetros y construir la cadena a verificar
    const signableString = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

    const expectedSignature = crypto
        .createHash('sha256')
        .update(signableString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

    // timingSafeEqual requiere que ambos buffers tengan la misma longitud.
    // Si son distintos, la firma es inválida — se retorna false sin lanzar error.
    if (signature.length !== expectedSignature.length) return false;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
};

export default { generateCloudinarySignature, verifyCloudinarySignature };
