import multer from "multer";
import CloudinaryStorage from 'multer-storage-cloudinary';
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "Gaddyel-Catalogo", // nombre de la carpeta en Cloudinary
        allowed_formats: ["jpg", "png", "jpeg", "webp"],
    },
});

export const upload = multer({ storage });
