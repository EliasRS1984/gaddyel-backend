/**
 * Routes: SystemConfig
 * 
 * ENDPOINTS:
 * - GET    /api/system-config              - Obtener configuración actual
 * - PUT    /api/system-config              - Actualizar configuración
 * - GET    /api/system-config/historial    - Ver historial de cambios
 * - POST   /api/system-config/preview-precio - Calcular preview de precio
 * - POST   /api/system-config/migrate-pricing - Ejecutar migración de precios (una vez)
 * - POST   /api/system-config/recalcular-precios - Recalcular todos los precios con nueva tasa
 * 
 * SEGURIDAD:
 * - Todos los endpoints requieren autenticación de admin
 */

import express from 'express';
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreviewPrecio,
  migrarPrecios,
  recalcularPrecios
} from '../controllers/systemConfigController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

// Proteger todas las rutas con autenticación de admin
router.use(verifyToken);

// Obtener configuración actual
router.get('/', obtenerConfiguracion);

// Actualizar configuración
router.put('/', actualizarConfiguracion);

// Ver historial de cambios
router.get('/historial', obtenerHistorial);

// Calcular preview de precios
router.post('/preview-precio', calcularPreviewPrecio);

// Ejecutar migración de precios (agregar precioBase a productos existentes - UNA VEZ)
router.post('/migrate-pricing', migrarPrecios);

// Recalcular TODOS los precios con nueva tasa de comisión
router.post('/recalcular-precios', recalcularPrecios);

export default router;
