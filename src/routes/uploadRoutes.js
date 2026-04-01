/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas para subir imágenes a Cloudinary desde el panel de administración.
 * Hay dos opciones: subir directamente desde el navegador (con firma segura)
 * o enviar la imagen al servidor y que este la suba a Cloudinary.
 *
 * ¿CÓMO FUNCIONA?
 * 1. /signature: El admin pide una firma criptográfica para subir directamente desde el navegador.
 * 2. POST /: Si se prefiere pasar por el servidor, este recibe la imagen,
 *    la valida, la sube a Cloudinary y borra el archivo temporal.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error al generar la firma? → Revisar CLOUDINARY_API_SECRET en variables de entorno
 * - ¿La imagen no sube? → Verificar que el tipo de archivo sea JPG, PNG, WEBP o GIF
 * - Documentación oficial: https://cloudinary.com/documentation/upload_images#authenticated_requests
 * ======================================================
 */

import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { generateCloudinarySignature } from "../config/cloudinarySignature.js";
import fs from "fs/promises";
import logger from "../utils/logger.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
// Solo admins pueden subir imágenes. Sin esta verificación,
// un cliente podría subir archivos arbitrarios a la cuenta de Cloudinary del negocio.
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de subida de imagen sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden subir imágenes' });
    }
    next();
};

// Configuramos multer para guardar temporalmente el archivo subido
const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 } // ✅ Máximo 5MB
});

// ======== FIRMA PARA SUBIDA DIRECTA ========
// El frontend solicita una firma antes de subir directamente a Cloudinary.
// Requiere autenticación para que solo admins puedan subir.
router.get('/signature', verifyToken, soloAdmin, (req, res) => {
    try {
        const folder = req.query.folder || 'Gaddyel-Productos';
        
        const signatureData = generateCloudinarySignature({
            folder: folder,
            resource_type: 'auto',
            type: 'upload'
        });
        
        res.json({
            ok: true,
            ...signatureData
        });
    } catch (error) {
        logger.error('Error generando firma para Cloudinary', { message: error.message });
        res.status(500).json({ error: 'Error generando firma de upload' });
    }
});

// ======== SUBIDA VÍA SERVIDOR ========
// El servidor recibe la imagen, la valida y la envía a Cloudinary.
// Más seguro pero más lento que la subida directa.
router.post("/", verifyToken, soloAdmin, upload.single("imagen"), async (req, res) => {
    try {
        // Validar que se recibió un archivo
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        // Solo se permiten imágenes en formatos seguros y comunes
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(req.file.mimetype)) {
            await fs.unlink(req.file.path).catch(() => null);
            return res.status(400).json({ error: 'Tipo de archivo no permitido' });
        }

        // Verificar tamaño (redundante con multer pero es una capa extra de seguridad)
        if (req.file.size > 5 * 1024 * 1024) {
            await fs.unlink(req.file.path).catch(() => null);
            return res.status(400).json({ error: 'Archivo demasiado grande (máx 5MB)' });
        }

        // Subir a Cloudinary con optimización automática de calidad y formato
        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: "Gaddyel-Productos",
            resource_type: 'auto',
            quality: 'auto',
            fetch_format: 'auto',
            allowed_formats: ['jpg', 'png', 'gif', 'webp'],
            max_file_size: 5242880 // 5MB
        });

        // Borrar el archivo temporal del servidor después de subir a Cloudinary
        await fs.unlink(req.file.path).catch(() => null);

        res.json({
            ok: true,
            mensaje: 'Imagen subida correctamente',
            url: resultado.secure_url,
            publicId: resultado.public_id,
            width: resultado.width,
            height: resultado.height,
            size: resultado.bytes
        });
    } catch (error) {
        // Limpiar el archivo temporal si algo fallió y aún existe
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => null);
        }
        
        logger.error('Error al subir imagen a Cloudinary', { message: error.message });
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
});

export default router;
