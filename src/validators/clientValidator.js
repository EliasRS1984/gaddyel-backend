/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Reglas de validación para datos de clientes.
 * Se verifican antes de guardar en la base de datos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El controlador recibe los datos del formulario.
 * 2. Los pasa por estos esquemas con Joi.
 * 3. Si algo no cumple las reglas, Joi devuelve un error
 *    con un mensaje claro para el cliente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error de validación inesperado? → Revisa el esquema
 *   clientSchema o filterClientsSchema según la operación.
 * ======================================================
 */

import Joi from 'joi';

// ======== CREAR O ACTUALIZAR CLIENTE ========
export const clientSchema = Joi.object({
    nombre: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({ 'string.min': 'Nombre mínimo 2 caracteres' }),
    
    email: Joi.string()
        .email()
        .required()
        .messages({ 'string.email': 'Email inválido' }),
    
    whatsapp: Joi.string()
        .trim()
        .regex(/^(\+?\d{1,3})?[\d\s\-()]{9,}$/)
        .required()
        .messages({ 'string.pattern.base': 'WhatsApp inválido. Formato: +549XXXXXXXXX o similar' }),
    
    notasInternas: Joi.string()
        .max(500)
        .allow('')
}).unknown(false);

// ======== ACTUALIZAR CLIENTE DESDE ADMIN ========
// A diferencia del esquema de creación, aquí todos los campos son opcionales
// (el admin puede cambiar solo el email, solo la dirección, etc.).
// Incluye campos de dirección que el esquema original no tenía.
// ¿El admin no puede guardar la dirección? Revisar que domicilio/localidad estén aquí.
export const clientUpdateSchema = Joi.object({
    nombre: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .messages({ 'string.min': 'Nombre mínimo 2 caracteres' }),

    email: Joi.string()
        .email()
        .messages({ 'string.email': 'Email inválido' }),

    whatsapp: Joi.string()
        .trim()
        .regex(/^(\+?\d{1,3})?[\d\s\-()]{9,}$/)
        .allow('')
        .messages({ 'string.pattern.base': 'WhatsApp inválido. Formato: +549XXXXXXXXX o similar' }),

    domicilio: Joi.string()
        .trim()
        .max(200)
        .allow(''),

    localidad: Joi.string()
        .trim()
        .max(100)
        .allow(''),

    provincia: Joi.string()
        .trim()
        .max(100)
        .allow(''),

    codigoPostal: Joi.string()
        .trim()
        .max(10)
        .allow(''),

    notasInternas: Joi.string()
        .max(500)
        .allow('')
}).min(1).unknown(false);
// .min(1) exige que venga al menos un campo — sin esto el admin podría enviar {} vacío

// ======== FUNCIÓN QUE APLICA LA VALIDACIÓN (para usar en rutas) ========
// Recibe un esquema Joi y devuelve una función que verifica el cuerpo del pedido.
// Si algo no cumple las reglas, responde con un mensaje de error sin llegar al controlador.
// ¿El admin recibe "Datos inválidos" inesperadamente? Revisar el esquema correspondiente.
export const validarCliente = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: false });
    if (error) {
        return res.status(400).json({
            exito: false,
            mensaje: 'Datos inválidos',
            errores: error.details.map(d => d.message)
        });
    }
    next();
};

// ======== FILTROS DE BÚSQL (PANEL ADMIN) ========
export const filterClientsSchema = Joi.object({
    buscar: Joi.string()
        .max(100),
    
    orderBy: Joi.string()
        .valid('nombre', 'email', 'fechaCreacion', 'totalGastado', 'totalPedidos')
        .default('fechaCreacion'),
    
    orden: Joi.string()
        .valid('asc', 'desc')
        .default('desc'),
    
    pagina: Joi.number()
        .integer()
        .min(1)
        .default(1),
    
    limite: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
}).unknown(false);
