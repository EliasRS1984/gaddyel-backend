import express from "express";
import { obtenerProductos, crearProducto, obtenerProductoPorId, obtenerProductosDestacados } from "../controllers/productController.js";
import { upload } from "../middleware/upload.js";


const router = express.Router();
// Obtener productos destacados
router.get("/destacados", obtenerProductosDestacados);

// Obtener todos los productos
router.get("/", obtenerProductos);

// Obtener un producto por ID (NUEVA RUTA)
router.get("/:id", obtenerProductoPorId);

// Crear producto con imagen (una sola imagen)
router.post("/", upload.single("imagen"), crearProducto);



export default router;
