import mongoose from "mongoose";

/**
 * Modelo para las imágenes del carrusel de la página de inicio
 */
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
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Índice para ordenar y filtrar activos
carouselImageSchema.index({ activo: 1, orden: 1 });

export const CarouselImage = mongoose.model('CarouselImage', carouselImageSchema);
