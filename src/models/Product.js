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
    imagenes: [imagenSchema],
    destacado: { type: Boolean, default: false },
    categoria: { type: String, required: true },
    material: { type: String },
    tamanos: [{ type: String }],
    colores: [{ type: String }],
    personalizable: { type: Boolean, default: false },
    precio: { type: Number, required: true },
    cantidadUnidades: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

export const Producto = mongoose.model("Producto", productoSchema);
