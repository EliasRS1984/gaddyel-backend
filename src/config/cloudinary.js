// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary'; // Importamos la librería Cloudinary
import dotenv from 'dotenv'; // Cargamos variables de entorno
dotenv.config(); // Habilitamos el uso del archivo .env

// Configuramos Cloudinary con las credenciales de tu cuenta
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Nombre del cloud (tu cuenta)
  api_key: process.env.CLOUDINARY_API_KEY,       // Clave pública
  api_secret: process.env.CLOUDINARY_API_SECRET  // Clave privada
});

// Exportamos el objeto configurado para poder usarlo en cualquier archivo
export default cloudinary;
