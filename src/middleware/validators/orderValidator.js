/**
 * ✅ Validadores Zod para Órdenes
 */

import { z } from 'zod';
import logger from '../../utils/logger.js';

// ✅ Esquema para crear orden
export const createOrderSchema = z.object({
    items: z.array(
        z.object({
            productoId: z.string()
                .regex(/^[0-9a-fA-F]{24}$/, 'ID de producto inválido'),
            cantidad: z.number()
                .int('Cantidad debe ser entero')
                .positive('Cantidad debe ser mayor a 0')
                .max(1000, 'Cantidad máximo 1000 unidades')
        })
    )
        .min(1, 'Debe haber al menos un producto')
        .max(100, 'Máximo 100 productos por orden'),
    
    domicilio: z.string()
        .min(5, 'Domicilio muy corto')
        .max(200, 'Domicilio muy largo'),
    
    localidad: z.string()
        .min(2, 'Localidad muy corta')
        .max(100, 'Localidad muy larga'),
    
    provincia: z.string()
        .min(2, 'Provincia muy corta')
        .max(100, 'Provincia muy larga'),
    
    codigoPostal: z.string()
        .regex(/^\d{4,6}$/, 'Código postal inválido'),
    
    notasAdicionales: z.string()
        .max(1000, 'Notas máximo 1000 caracteres')
        .optional(),
    
    metodoPago: z.enum(['mercado_pago', 'transferencia', 'efectivo'])
        .default('mercado_pago'),
    
    shipping: z.object({
        costo: z.number().nonnegative('Costo de envío no puede ser negativo')
    }).optional()
});

// ✅ Middleware validador para crear orden
export const validateCreateOrder = (req, res, next) => {
    try {
        const data = createOrderSchema.parse(req.body);
        req.validatedData = data;
        next();
    } catch (error) {
        logger.warn('Validación fallida en crear orden', { 
            errors: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
        return res.status(400).json({
            error: 'Validación fallida',
            details: error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
            }))
        });
    }
};
