/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * La ruta para importar productos desde el archivo JSON.
 * Solo se usa cuando se necesita cargar los datos iniciales al servidor.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Solo está disponible en entorno de desarrollo (NODE_ENV !== 'production').
 * 2. En producción, este endpoint no existe.
 *    Esto evita que alguien externo pueda sobrescribir el catálogo de productos.
 * 3. Si se necesita hacer un seed en producción, debe hacerse directamente
 *    desde un script en el servidor con acceso directo a la base de datos.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Falla la importación? → Revisar importarProductos en seedController y Data/productos.json
 * - ¿El endpoint da 404 en producción? → Es correcto, está deshabilitado intencionalmente
 * ======================================================
 */

import express from "express";
import { importarProductos } from "../controllers/seedController.js";
import verifyToken from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ======== PROTECCIÓN DOBLE ========
// Esta ruta tiene dos niveles de protección para que no pueda
// usarse desde internet para sobrescribir el catálogo de productos.

// NIVEL 1: Solo funciona en desarrollo (no en producción en Render)
// Si alguien intenta acceder en producción, recibe un 404.
router.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        logger.security('Intento de acceso a seed endpoint en producción', {
            ip: req.ip,
            method: req.method,
            path: req.path
        });
        return res.status(404).json({ error: 'Ruta no disponible' });
    }
    next();
});

// NIVEL 2: Requiere token de administrador válido
router.post("/", verifyToken, (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden ejecutar el seed' });
    }
    next();
}, importarProductos);

export default router;
