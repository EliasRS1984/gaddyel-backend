import Joi from 'joi';

/**
 * Validación para creación de orden
 * El frontend envía: items (con id y cantidad), datos del cliente
 */
export const createOrderSchema = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                productoId: Joi.string()
                    .required()
                    .regex(/^[0-9a-fA-F]{24}$/)
                    .messages({ 'string.pattern.base': 'ID de producto inválido' }),
                cantidad: Joi.number()
                    .integer()
                    .min(1)
                    .max(100)
                    .required()
                    .messages({ 'number.min': 'Cantidad mínima: 1', 'number.max': 'Cantidad máxima: 100' })
            })
        )
        .min(1)
        .required()
        .messages({ 'array.min': 'El carrito debe tener al menos 1 producto' }),
    
    cliente: Joi.object({
        nombre: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({ 'string.min': 'Nombre mínimo 2 caracteres', 'string.max': 'Nombre máximo 100' }),
        
        email: Joi.string()
            .email()
            .required()
            .messages({ 'string.email': 'Email inválido' }),
        
        whatsapp: Joi.string()
            .trim()
            .regex(/^\d{10,15}$/)
            .required()
            .messages({ 
                'string.pattern.base': 'WhatsApp debe tener 10-15 dígitos',
                'any.required': 'El WhatsApp es obligatorio'
            }),
        
        direccion: Joi.string()
            .trim()
            .min(10)
            .max(200)
            .required()
            .messages({ 
                'string.min': 'Dirección mínimo 10 caracteres',
                'string.max': 'Dirección máximo 200 caracteres',
                'any.required': 'La dirección es obligatoria'
            }),
        
        ciudad: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({ 
                'string.min': 'Ciudad mínimo 2 caracteres',
                'any.required': 'La ciudad es obligatoria'
            }),
        
        codigoPostal: Joi.string()
            .trim()
            .regex(/^\d{4,6}$/)
            .required()
            .messages({ 
                'string.pattern.base': 'Código postal inválido (debe tener 4-6 dígitos)',
                'any.required': 'El código postal es obligatorio'
            }),
        
        notasAdicionales: Joi.string()
            .trim()
            .max(500)
            .allow('')
            .messages({ 'string.max': 'Notas máximo 500 caracteres' })
    }).required()
});

/**
 * Validación para actualizar estado del pedido (admin)
 */
export const updateOrderStatusSchema = Joi.object({
    estadoPedido: Joi.string()
        .valid('pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado')
        .required(),
    
    notasInternas: Joi.string()
        .max(500)
        .allow(''),
    
    fechaEntregaEstimada: Joi.date()
        .greater('now')
        .allow(null)
}).unknown(false);

/**
 * Validación para filtrar órdenes (admin)
 */
export const filterOrdersSchema = Joi.object({
    estadoPago: Joi.string()
        .valid('pending', 'approved', 'rejected', 'cancelled'),
    
    estadoPedido: Joi.string()
        .valid('pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado'),
    
    clienteId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/),
    
    desde: Joi.date(),
    hasta: Joi.date(),
    
    pagina: Joi.number()
        .integer()
        .min(1)
        .default(1),
    
    limite: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
});
