/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Conexión al servicio de imágenes Cloudinary.
 * Cloudinary almacena y entrega todas las fotos de los productos.
 * Este archivo configura las credenciales de acceso una sola vez
 * para que cualquier parte del sistema pueda subir o leer imágenes.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lee las credenciales del archivo .env (nunca se escriben en el código)
 * 2. Configura la librería oficial de Cloudinary con esas credenciales
 * 3. Exporta la librería lista para usar en cualquier otro archivo
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Las imágenes no se suben? → Verificar CLOUDINARY_CLOUD_NAME,
 *   CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el archivo .env
 * - ¿Error "Invalid signature"? → Las credenciales en .env son incorrectas
 * - ¿Error de conexión? → Verificar que la cuenta de Cloudinary esté activa
 * - Documentación oficial: https://cloudinary.com/documentation/node_integration
 * ======================================================
 */

import { v2 as cloudinary } from 'cloudinary';

// ======== CREDENCIALES DE ACCESO ========
// Las credenciales se leen desde el archivo .env para no exponerlas en el código.
// CLOUDINARY_NAME es el nombre alternativo que usaba la versión anterior del proyecto.
// secure: true garantiza que todas las URLs de imágenes generadas usen HTTPS.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true
});

export default cloudinary;
