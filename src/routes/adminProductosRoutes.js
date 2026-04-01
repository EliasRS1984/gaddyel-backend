/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas para gestionar productos desde el panel de administración.
 * Todas requieren que el admin haya iniciado sesión.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿No se pueden crear productos? → Revisar crearProducto en productController.js
 * - ¿El toggle de destacado no funciona? → Revisar toggleDestacadoProducto
 * ======================================================
 */

import express from "express";
import {
    getProductos,
    crearProducto,
    editarProducto,
    eliminarProducto,
    toggleDestacadoProducto
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validarProducto, productoCreateSchema, productoUpdateSchema } from "../validators/productValidator.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
// Solo admins pueden gestionar el catálogo de productos.
// Sin esta verificación, un cliente con su propio token podría
// crear, editar o eliminar productos del catálogo.
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a gestión de productos sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden gestionar productos' });
    }
    next();
};

router.use(authMiddleware);
router.use(soloAdmin);

// Obtener todos los productos
router.get("/", getProductos);

// Crear un producto
router.post("/", validarProducto(productoCreateSchema), crearProducto);

// Editar un producto
router.put("/:id", validarProducto(productoUpdateSchema), editarProducto);

// Toggle destacado de un producto
router.patch("/:id/destacado", toggleDestacadoProducto);

// Eliminar un producto
router.delete("/:id", eliminarProducto);

export default router;
