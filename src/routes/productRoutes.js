/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas públicas de productos para la tienda online.
 * Estas rutas no requieren autenticación.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los productos no aparecen? → Revisar obtenerProductos en productController
 * - Para crear/editar/eliminar productos, usar las rutas en adminProductosRoutes
 * ======================================================
 */

import express from "express";
import { obtenerProductos, obtenerProductoPorId, obtenerProductosDestacados, obtenerProductosSinPaginacion } from "../controllers/productController.js";

const router = express.Router();

// Productos destacados (para el carrusel de la página de inicio)
router.get("/destacados", obtenerProductosDestacados);

// Todos los productos sin paginación (para catálogo completo)
// Debe ir antes de /:id para que Express no lo confunda con un ID
router.get("/all", obtenerProductosSinPaginacion);

// Lista de productos con paginación
router.get("/", obtenerProductos);

// Detalle de un producto por su ID
router.get("/:id", obtenerProductoPorId);



export default router;
