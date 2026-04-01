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
// Define qué campos son obligatorios y cuáles son sus límites.
// Los campos opcionales se envían solo si el admin los completó.
export const productoCreateSchema = Joi.object({
    nombre:               Joi.string().min(2).max(150).required(),
    descripcion:          Joi.string().max(300).allow("").optional(),
    descripcionCompleta:  Joi.string().allow("").optional(),
    categoria:            Joi.string().required(),
    material:             Joi.string().allow("").optional(),
    // Precio base (lo que nos cuesta) y precio de venta (lo que cobra el cliente)
    precioBase:           Joi.number().min(0).required(),
    precio:               Joi.number().min(0).required(),
    tasaComisionAplicada: Joi.number().min(0).max(1).optional(),
    // Tamaños y colores pueden llegar como texto CSV o como arrays
    tamanos:              Joi.alternatives().try(
                            Joi.array().items(Joi.string()),
                            Joi.string()
                          ).optional(),
    // Colores pueden ser strings simples, strings "Nombre|#hex" u objetos {nombre, hex}
    colores:              Joi.alternatives().try(
                            Joi.array().items(Joi.alternatives().try(
                              Joi.object({ nombre: Joi.string(), hex: Joi.string().allow("") }),
                              Joi.string()
                            )),
                            Joi.string()
                          ).optional(),
    personalizable:       Joi.boolean().optional(),
    cantidadUnidades:     Joi.number().integer().min(0).optional(),
    destacado:            Joi.boolean().optional(),
    // URLs de imágenes (Cloudinary)
    imagenSrc:            Joi.string().uri().allow("").optional(),
    imagenes:             Joi.array().items(
                            Joi.object({
                              src: Joi.string().uri().allow(""),
                              alt: Joi.string().allow("").optional()
                            })
                          ).max(20).optional(),
    propiedadesPersonalizadas: Joi.object().unknown(true).optional(),
});

// ======== ESQUEMA DE VALIDACIÓN PARA EDITAR PRODUCTO ========
// Al editar, todos los campos son opcionales porque se puede actualizar
// solo una parte del producto (nombre, precio, fotos, etc.)
export const productoUpdateSchema = Joi.object({
    nombre:               Joi.string().min(2).max(150).optional(),
    descripcion:          Joi.string().max(300).allow("").optional(),
    descripcionCompleta:  Joi.string().allow("").optional(),
    categoria:            Joi.string().optional(),
    material:             Joi.string().allow("").optional(),
    precioBase:           Joi.number().min(0).optional(),
    precio:               Joi.number().min(0).optional(),
    tasaComisionAplicada: Joi.number().min(0).max(1).optional(),
    tamanos:              Joi.alternatives().try(
                            Joi.array().items(Joi.string()),
                            Joi.string()
                          ).optional(),
    colores:              Joi.alternatives().try(
                            Joi.array().items(Joi.alternatives().try(
                              Joi.object({ nombre: Joi.string(), hex: Joi.string().allow("") }),
                              Joi.string()
                            )),
                            Joi.string()
                          ).optional(),
    personalizable:       Joi.boolean().optional(),
    cantidadUnidades:     Joi.number().integer().min(0).optional(),
    destacado:            Joi.boolean().optional(),
    imagenSrc:            Joi.string().uri().allow("").optional(),
    imagenes:             Joi.array().items(
                            Joi.object({
                              src: Joi.string().uri().allow(""),
                              alt: Joi.string().allow("").optional()
                            })
                          ).max(20).optional(),
    propiedadesPersonalizadas: Joi.object().unknown(true).optional(),
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

    const { error, value } = schema.validate(payload, {
        abortEarly: false,
        convert: true,
        allowUnknown: false   // bloquea campos no declarados en el schema
    });
    if (error) {
        const detalles = error.details.map(d => d.message);
        return res.status(400).json({ error: "Validación fallida", detalles });
    }
    // Re-escribimos req.body con datos normalizados
    req.body = value;
    next();
};
    next();
};
