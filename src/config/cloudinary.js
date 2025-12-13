// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary'; // Importamos la librería Cloudinary
import dotenv from 'dotenv'; // Cargamos variables de entorno
dotenv.config(); // Habilitamos el uso del archivo .env

// Configuramos Cloudinary con las credenciales de tu cuenta
// Soporta múltiples nombres de variables para compatibilidad
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Exportamos el objeto configurado para poder usarlo en cualquier archivo
export default cloudinary;
