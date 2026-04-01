// =======================================================================
// ¿QUÉ ES ESTO?
// Archivo que define las URL (rutas) para gestionar clientes desde el panel de administración.
// La lógica de cada acción está en adminClientesController.js.
//
// ¿CÓMO FUNCIONA?
// Cada línea conecta una URL con la función del controlador que la ejecuta.
// Todas las rutas requieren que el admin haya iniciado sesión (authMiddleware).
// =======================================================================

import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';
import {
    listarClientes,
    obtenerCliente,
    actualizarCliente,
    eliminarCliente
} from '../controllers/adminClientesController.js';

const router = express.Router();

// ======== VERIFICACIÓN DE ROL ========
// Todas las rutas de este archivo manejan PII de clientes (nombre, email, teléfono, dirección).
// Solo admins pueden acceder. Sin esta verificación, un cliente con su propio token
// podría listar todos los demás clientes o eliminarlos (mismo secreto JWT que admin).
const soloAdmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'admin') {
        logger.security('Intento de acceso a gestión de clientes sin rol admin', { userId: req.user?.id });
        return res.status(403).json({ error: 'Solo administradores pueden acceder a esta sección' });
    }
    next();
};

// Primero verificar token válido, luego verificar que sea admin
router.use(authMiddleware);
router.use(soloAdmin);

// Obtener lista de todos los clientes (con búsqueda opcional ?buscar=texto)
router.get('/', listarClientes);

// Obtener los datos completos de un cliente específico con su historial de pedidos
router.get('/:id', obtenerCliente);

// Actualizar datos de un cliente (nombre, email, whatsapp, dirección)
router.put('/:id', actualizarCliente);

// Eliminar un cliente de la base de datos (acción destructiva — confirmada en el frontend)
router.delete('/:id', eliminarCliente);

export default router;
