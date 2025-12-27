import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { generateCloudinarySignature } from "../config/cloudinarySignature.js";
import fs from "fs";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

// Configuramos multer para guardar temporalmente el archivo subido
const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 } // ✅ Máximo 5MB
});

/**
 * ✅ GET /api/upload/signature - Generar firma segura
 * Cliente llama esto PRIMERO antes de subir
 * Requiere autenticación
 */
router.get('/signature', verifyToken, (req, res) => {
    try {
        const signatureData = generateCloudinarySignature({
            folder: 'Gaddyel-Productos',
            resource_type: 'auto',
            type: 'upload'
        });
        
        res.json({
            ok: true,
            ...signatureData
        });
    } catch (error) {
        console.error('❌ Error generando firma:', error);
        res.status(500).json({ error: 'Error generando firma de upload' });
    }
});

/**
 * ✅ POST /api/upload - Subir imagen vía backend (alternativa segura)
 * Backend maneja toda comunicación con Cloudinary
 * Requiere autenticación
 */
router.post("/", verifyToken, upload.single("imagen"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        // ✅ Validar tipo de archivo
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(req.file.mimetype)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Tipo de archivo no permitido' });
        }

        // ✅ Validar tamaño (redundante pero seguro)
        if (req.file.size > 5 * 1024 * 1024) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Archivo demasiado grande (máx 5MB)' });
        }

        // ✅ Subir a Cloudinary desde backend
        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: "Gaddyel-Productos",
            resource_type: 'auto',
            quality: 'auto',
            fetch_format: 'auto',
            allowed_formats: ['jpg', 'png', 'gif', 'webp'],
            max_file_size: 5242880 // 5MB
        });

        // ✅ Borrar archivo temporal
        fs.unlinkSync(req.file.path);

        res.json({
            ok: true,
            mensaje: "✅ Imagen subida correctamente",
            url: resultado.secure_url,
            publicId: resultado.public_id,
            width: resultado.width,
            height: resultado.height,
            size: resultado.bytes
        });
    } catch (error) {
        // Limpiar archivo si existe
        if (req.file?.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Error limpiando archivo:', e);
            }
        }
        
        console.error("❌ Error al subir imagen:", error);
        res.status(500).json({ error: "Error al subir la imagen" });
    }
});

export default router;
