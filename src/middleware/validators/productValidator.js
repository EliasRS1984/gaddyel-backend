/**
 * ✅ Validadores Zod para Productos
 * Validación declarativa, type-safe, con mensajes personalizados
 */

import { z } from 'zod';
import logger from '../../utils/logger.js';

// ✅ Esquema para crear producto
export const createProductSchema = z.object({
    nombre: z.string()
        .min(3, 'Nombre debe tener mínimo 3 caracteres')
        .max(200, 'Nombre máximo 200 caracteres')
        .trim(),
    
    descripcion: z.string()
        .min(10, 'Descripción muy corta (mínimo 10 caracteres)')
        .max(500, 'Descripción máximo 500 caracteres')
        .trim(),
    
    descripcionCompleta: z.string()
        .min(20, 'Descripción completa muy corta')
        .max(2000, 'Descripción completa máximo 2000 caracteres')
        .trim(),
    
    precio: z.number()
        .positive('Precio debe ser positivo')
        .max(1000000, 'Precio excede límite permitido'),
    
    categoria: z.string()
        .min(3, 'Categoría requerida')
        .max(100, 'Categoría muy larga'),
    
    material: z.string().optional(),
    
    tamanos: z.array(
        z.string().max(10, 'Tamaño máximo 10 caracteres')
    )
        .max(15, 'Máximo 15 tamaños')
        .default([]),
    
    colores: z.array(
        z.string().max(20, 'Color máximo 20 caracteres')
    )
        .max(30, 'Máximo 30 colores')
        .default([]),
    
    cantidadUnidades: z.number()
        .int('Cantidad debe ser entero')
        .nonnegative('Stock no puede ser negativo')
        .max(10000, 'Stock máximo 10000 unidades')
        .default(1),
    
    imagenes: z.array(
        z.object({
            src: z.string().url('URL de imagen inválida'),
            alt: z.string().max(200, 'Alt máximo 200 caracteres').optional()
        })
    )
        .max(20, 'Máximo 20 imágenes')
        .default([]),
    
    imagenSrc: z.string().url('URL principal debe ser válida').optional(),
    
    destacado: z.boolean().default(false),
    
    personalizable: z.boolean().default(false),
    
    propiedadesPersonalizadas: z.record(z.string()).optional()
});

// ✅ Esquema para actualizar producto (todos los campos opcionales)
export const updateProductSchema = createProductSchema.partial();

// ✅ Middleware validador para crear producto
export const validateCreateProduct = (req, res, next) => {
    try {
        const data = createProductSchema.parse(req.body);
        req.validatedData = data;
        next();
    } catch (error) {
        logger.warn('Validación fallida en crear producto', { 
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

// ✅ Middleware validador para actualizar producto
export const validateUpdateProduct = (req, res, next) => {
    try {
        const data = updateProductSchema.parse(req.body);
        req.validatedData = data;
        next();
    } catch (error) {
        logger.warn('Validación fallida en actualizar producto', { 
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
