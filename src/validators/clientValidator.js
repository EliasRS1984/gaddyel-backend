import Joi from 'joi';

/**
 * Validación para crear/actualizar cliente
 */
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

/**
 * Validación para filtrar clientes (admin)
 */
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
