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
            .regex(/^(\+?\d{1,3})?[\d\s\-()]{9,}$/)
            .required()
            .messages({ 'string.pattern.base': 'WhatsApp inválido' })
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
