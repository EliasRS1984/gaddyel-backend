/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La estructura de las imágenes del carrusel en la base de datos.
 * Cada imagen del carrusel principal de la página de inicio
 * se guarda con estos campos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cada imagen tiene una URL (src), un texto alternativo (alt),
 *    una descripción opcional (caption), un orden de aparición y
 *    un estado activo/inactivo.
 * 2. El campo 'publicId' permite eliminar la imagen de Cloudinary
 *    cuando se borra del panel.
 * 3. Las imágenes se ordenan por el campo 'orden' de menor a mayor.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Las imágenes no aparecen en orden? → Verificar el campo 'orden' de cada imagen
 * - ¿No se pueden borrar imágenes de Cloudinary? → Verificar que 'publicId' esté guardado
 * - Documentación oficial: https://mongoosejs.com/docs/guide.html
 * ======================================================
 */

import mongoose from "mongoose";
const carouselImageSchema = new mongoose.Schema(
  {
    src: { 
      type: String, 
      required: [true, 'La URL de la imagen es obligatoria']
    },
    alt: { 
      type: String, 
      default: "Imagen del carrusel Gaddyel",
      trim: true
    },
    caption: { 
      type: String, 
      default: "",
      trim: true,
      maxlength: [200, 'El caption no puede exceder 200 caracteres']
    },
    orden: { 
      type: Number, 
      default: 0,
      index: true
    },
    activo: { 
      type: Boolean, 
      default: true,
      index: true
    },
    publicId: {
      type: String, // Para Cloudinary, facilita eliminación
      default: null
    },
    // URL de la imagen adaptada para pantallas de celular (formato vertical 3:4).
    // Si no se carga ninguna, el carrusel mostrará la imagen de escritorio como respaldo.
    srcMobile: {
      type: String,
      default: null
    },
    // ID de Cloudinary para la imagen móvil, necesario para borrarla cuando se elimina la entrada.
    publicIdMobile: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Índice compuesto: permite buscar rápidamente las imágenes activas ya ordenadas
carouselImageSchema.index({ activo: 1, orden: 1 });

export const CarouselImage = mongoose.model('CarouselImage', carouselImageSchema);
