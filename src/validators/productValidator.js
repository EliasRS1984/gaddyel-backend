/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Reglas de validación para datos de productos.
 * Se verifican antes de crear o actualizar un producto.
 *
 * ¿CÓMO FUNCIONA?
 * 1. productoCreateSchema define qué campos son obligatorios
 *    y cuáles son sus límites (largo de texto, precio mínimo, etc.).
 * 2. validarProducto() es una función que se usa en las rutas
 *    para ejecutar la validación automáticamente.
 * 3. Si los datos son válidos, pasa al controlador con el
 *    cuerpo de la solicitud normalizado.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error al crear producto? → Revisar productoCreateSchema.
 * - ¿Los tamaños o colores no se guardan? → La función
 *   validarProducto() convierte strings CSV en arrays.
 * ======================================================
 */

// src/validators/productValidator.js
import Joi from "joi";

// ======== ESQUEMA DE VALIDACIÓN PARA CREAR PRODUCTO ========
export const productoCreateSchema = Joi.object({
    nombre: Joi.string().min(2).max(150).required(),
    descripcion: Joi.string().max(300).allow("").optional(),
    descripcionCompleta: Joi.string().allow("").optional(),
    categoria: Joi.string().required(),
    material: Joi.string().allow("").optional(),
    tamanos: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    colores: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    personalizable: Joi.boolean().optional(),
    precio: Joi.number().min(0).required(),
    cantidadUnidades: Joi.number().integer().min(1).required(),
    destacado: Joi.boolean().optional()
});

// ======== FUNCIÓN REUTILIZABLE PARA APLICAR VALIDACIÓN EN RUTAS ========
// Se usa en las rutas del admin: router.post('/', validarProducto(productoCreateSchema), controlador).
// También convierte tamaños y colores enviados como texto separado por comas en arrays.
export const validarProducto = (schema) => (req, res, next) => {
    const payload = { ...req.body };

    // Si vienen tamanos o colores como CSV (desde un form), dejarlo pasar:
    if (typeof payload.tamanos === "string") {
        payload.tamanos = payload.tamanos.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (typeof payload.colores === "string") {
        payload.colores = payload.colores.split(",").map(s => s.trim()).filter(Boolean);
    }

    const { error, value } = schema.validate(payload, { abortEarly: false, convert: true });
    if (error) {
        const detalles = error.details.map(d => d.message);
        return res.status(400).json({ error: "Validación fallida", detalles });
    }
    // Re-escribimos req.body con datos normalizados
    req.body = value;
    next();
};
