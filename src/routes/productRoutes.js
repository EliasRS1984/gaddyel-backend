import express from "express";
import { obtenerProductos, obtenerProductoPorId, obtenerProductosDestacados, obtenerProductosSinPaginacion } from "../controllers/productController.js";

const router = express.Router();

// Obtener productos destacados
router.get("/destacados", obtenerProductosDestacados);

// ✅ NUEVO: Obtener TODOS los productos sin paginación (antes de la ruta /productos/:id)
router.get("/all", obtenerProductosSinPaginacion);

// Obtener todos los productos
router.get("/", obtenerProductos);

// Obtener un producto por ID (NUEVA RUTA)
router.get("/:id", obtenerProductoPorId);

// ❌ NOTA: Creación de productos se hace desde /api/admin/productos (adminProductosRoutes)
// Esta ruta pública no se usa



export default router;
