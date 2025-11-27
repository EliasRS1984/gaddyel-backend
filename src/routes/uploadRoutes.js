import express from "express";
import multer from "multer"; // Multer permite manejar archivos en Express
import cloudinary from "../config/cloudinary.js"; // Importamos nuestra config
import fs from "fs"; // Módulo para manipular archivos locales

const router = express.Router();

// Configuramos multer para guardar temporalmente el archivo subido
const upload = multer({ dest: "uploads/" });

// Endpoint para subir una imagen a Cloudinary
router.post("/", upload.single("imagen"), async (req, res) => {
    try {
        // Subimos el archivo temporal a Cloudinary
        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: "Gaddyel-Productos", // Carpeta en Cloudinary (puede cambiarse)
        });

        // Borramos el archivo local una vez subido
        fs.unlinkSync(req.file.path);

        // Devolvemos la URL segura que generó Cloudinary
        res.json({
            mensaje: "✅ Imagen subida correctamente",
            url: resultado.secure_url,
        });
    } catch (error) {
        console.error("❌ Error al subir imagen:", error);
        res.status(500).json({ error: "Error al subir la imagen" });
    }
});

export default router;
