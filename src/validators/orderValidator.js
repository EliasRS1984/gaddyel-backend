/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Reglas de validación para datos de pedidos.
 * Se verifican antes de crear o actualizar un pedido.
 *
 * ¿CÓMO FUNCIONA?
 * 1. createOrderSchema valida que el carrito y los datos
 *    del cliente estén completos y bien formados.
 * 2. updateOrderStatusSchema valida que el admin solo pueda
 *    pasar el pedido a estados permitidos.
 * 3. filterOrdersSchema valida los filtros del panel admin.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error al crear pedido con datos válidos? → Revisar
 *   createOrderSchema, especialmente los campos de dirección.
 * - ¿El admin no puede cambiar el estado? → Revisar los
 *   valores permitidos en updateOrderStatusSchema.
 * ======================================================
 */

import Joi from 'joi';

// ======== CREAR PEDIDO (DESDE EL FRONTEND) ========
// El cliente envía su carrito y sus datos de contacto y envío.
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
        
        domicilio: Joi.string()
            .trim()
            .min(10)
            .max(200)
            .required()
            .messages({ 
                'string.min': 'Domicilio mínimo 10 caracteres',
                'string.max': 'Domicilio máximo 200 caracteres',
                'any.required': 'El domicilio es obligatorio'
            }),
        
        localidad: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({ 
                'string.min': 'Localidad mínimo 2 caracteres',
                'any.required': 'La localidad es obligatoria'
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

// ======== ACTUALIZAR ESTADO DEL PEDIDO (ADMIN) ========
// El admin solo puede cambiar el estadoPedido.
// El estadoPago lo actualiza exclusivamente el webhook de Mercado Pago.
export const updateOrderStatusSchema = Joi.object({
    estadoPedido: Joi.string()
        .valid('en_produccion', 'enviado', 'entregado')
        .required()
        .messages({
            'any.only': 'estadoPedido debe ser: en_produccion, enviado o entregado'
        }),
    
    notasInternas: Joi.string()
        .max(500)
        .allow(''),
    
    fechaEntregaEstimada: Joi.date()
        .greater('now')
        .allow(null)
}).unknown(false);

// ======== FILTROS DE BÚSQL DE PEDIDOS (ADMIN) ========
// Los valores de estado están sincronizados con el modelo Order.js.
export const filterOrdersSchema = Joi.object({
    estadoPago: Joi.string()
        .valid('pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded'),
    
    estadoPedido: Joi.string()
        .valid('en_produccion', 'enviado', 'entregado'),
    
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
