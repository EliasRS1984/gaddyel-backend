/**
 * Routes: PaymentConfig
 * 
 * ENDPOINTS:
 * - GET    /api/payment-config           - Obtener configuración actual
 * - PUT    /api/payment-config           - Actualizar y recalcular productos
 * - GET    /api/payment-config/historial - Ver historial de cambios
 * - POST   /api/payment-config/preview   - Calcular preview sin guardar
 * 
 * SEGURIDAD:
 * - Todos los endpoints requieren autenticación de admin
 */

import express from 'express';
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHistorial,
  calcularPreview
} from '../controllers/paymentConfigController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Proteger todas las rutas con autenticación de admin
router.use(authenticateToken);

// Obtener configuración actual
router.get('/', obtenerConfiguracion);

// Actualizar configuración y recalcular productos
router.put('/', actualizarConfiguracion);

// Ver historial de cambios
router.get('/historial', obtenerHistorial);

// Calcular preview de precios
router.post('/preview', calcularPreview);

export default router;
