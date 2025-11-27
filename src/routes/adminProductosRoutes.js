import express from "express";
import {
    getProductos,
    crearProducto,
    editarProducto,
    eliminarProducto
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener todos los productos
router.get("/", getProductos);

// Crear un producto
router.post("/", crearProducto);

// Editar un producto
router.put("/:id", editarProducto);

// Eliminar un producto
router.delete("/:id", eliminarProducto);

export default router;
