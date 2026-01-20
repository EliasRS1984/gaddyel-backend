import mongoose from "mongoose";

const imagenSchema = new mongoose.Schema({
  src: { type: String, required: true },
  alt: { type: String, default: "" },
});

const productoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    descripcionCompleta: { type: String, required: true },
    imagenSrc: { type: String },
    imagenes: {
      type: [imagenSchema],
      validate: {
        validator: function(arr) {
          return arr.length <= 20; // ✅ Máximo 20 imágenes
        },
        message: 'Un producto no puede tener más de 20 imágenes'
      }
    },
    destacado: { type: Boolean, default: false, index: true },
    categoria: { type: String, required: true, index: true },
    material: { type: String },
    tamanos: {
      type: [{ type: String }],
      validate: {
        validator: function(arr) {
          return arr.length <= 15;
        },
        message: 'Máximo 15 tamaños'
      }
    },
    colores: {
      type: [{ type: String }],
      validate: {
        validator: function(arr) {
          return arr.length <= 30;
        },
        message: 'Máximo 30 colores'
      }
    },
    personalizable: { type: Boolean, default: false },
    
    // PRICING: Sistema dual para manejar comisiones de pasarela
    // precioBase: Lo que el negocio necesita recibir (sin comisión)
    // precio (precioVenta): Lo que ve el cliente (ya incluye comisión MP)
    precioBase: { 
      type: Number, 
      required: false, // Opcional para permitir migración de productos antiguos
      index: true,
      min: 0,
      default: 0
    },
    precio: { 
      type: Number, 
      required: true, 
      index: true,
      min: 0
    }, // precio = precioBase / (1 - tasaComision)
    
    // Metadatos de pricing
    tasaComisionAplicada: { 
      type: Number, 
      default: 0.0761 
    }, // Tasa usada en el último cálculo
    fechaActualizacionPrecio: { 
      type: Date, 
      default: Date.now 
    },
    
    cantidadUnidades: { type: Number, default: 1 },
    propiedadesPersonalizadas: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true,
  }
);

// ✅ ÍNDICES para optimizar queries frecuentes
productoSchema.index({ destacado: 1, createdAt: -1 }); // Productos destacados ordenados por fecha
productoSchema.index({ categoria: 1, precio: 1 }); // Filtrar por categoría y rango de precio
productoSchema.index({ nombre: 'text', descripcion: 'text' }); // Búsqueda full-text
productoSchema.index({ createdAt: -1 }); // Ordenar por fecha más reciente

export const Producto = mongoose.model("Producto", productoSchema);
