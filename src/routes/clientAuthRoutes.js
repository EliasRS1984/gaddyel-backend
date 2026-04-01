/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Las rutas de autenticación para clientes de la tienda.
 * Maneja registro, login, consulta y actualización de perfil.
 *
 * ¿CÓMO FUNCIONA?
 * 1. /registro: Crea una cuenta nueva de cliente.
 * 2. /login: Verifica credenciales y devuelve un token JWT.
 * 3. /perfil (GET): Devuelve los datos del cliente autenticado.
 * 4. /perfil (PUT): Actualiza nombre y whatsapp del cliente.
 * 5. /direccion: Actualiza la dirección de envío del cliente.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El registro falla? → Revisar las validaciones al inicio de cada ruta
 * - ¿El token no funciona? → Verificar JWT_SECRET o JWT_ACCESS_SECRET en variables de entorno
 * - ¿La dirección no se guarda? → Los campos son 'domicilio', 'localidad', 'provincia', 'codigoPostal'
 * ======================================================
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import Client from '../models/Client.js';

const router = express.Router();

// ======== REGISTRO DE CLIENTE ========
// Crea una cuenta nueva validando todos los campos antes de guardar.
router.post('/registro', async (req, res) => {
    try {
        const { nombre, email, password, whatsapp } = req.body;

        // ✅ VALIDACIÓN 1: Campos requeridos
        if (!nombre || !email || !password || !whatsapp) {
            return res.status(400).json({ 
                error: 'Todos los campos son requeridos',
                campos: { nombre, email, password: !!password, whatsapp }
            });
        }

        // ✅ VALIDACIÓN 2: Formato de nombre
        const nombreTrim = nombre.trim();
        if (nombreTrim.length < 3) {
            return res.status(400).json({ 
                error: 'El nombre debe tener al menos 3 caracteres' 
            });
        }
        if (nombreTrim.length > 100) {
            return res.status(400).json({ 
                error: 'El nombre es demasiado largo (máximo 100 caracteres)' 
            });
        }
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombreTrim)) {
            return res.status(400).json({ 
                error: 'El nombre solo puede contener letras y espacios' 
            });
        }

        // ✅ VALIDACIÓN 3: Formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailLower = email.toLowerCase().trim();
        if (!emailRegex.test(emailLower)) {
            return res.status(400).json({ 
                error: 'Formato de email inválido' 
            });
        }
        if (emailLower.length > 255) {
            return res.status(400).json({ 
                error: 'Email demasiado largo' 
            });
        }

        // ✅ VALIDACIÓN 4: Fortaleza de contraseña (OWASP)
        if (password.length < 8) {
            return res.status(400).json({ 
                error: 'La contraseña debe tener al menos 8 caracteres' 
            });
        }
        if (password.length > 128) {
            return res.status(400).json({ 
                error: 'La contraseña es demasiado larga' 
            });
        }
        if (!/(?=.*[a-z])/.test(password)) {
            return res.status(400).json({ 
                error: 'La contraseña debe contener al menos una letra minúscula' 
            });
        }
        if (!/(?=.*[A-Z])/.test(password)) {
            return res.status(400).json({ 
                error: 'La contraseña debe contener al menos una letra mayúscula' 
            });
        }
        if (!/(?=.*\d)/.test(password)) {
            return res.status(400).json({ 
                error: 'La contraseña debe contener al menos un número' 
            });
        }

        // ✅ VALIDACIÓN 5: Formato de WhatsApp
        const whatsappClean = whatsapp.replace(/[\s\-+]/g, '');
        if (!/^\d{10,15}$/.test(whatsappClean)) {
            return res.status(400).json({ 
                error: 'Formato de WhatsApp inválido (10-15 dígitos)' 
            });
        }

        // ✅ VALIDACIÓN 6: Verificar email duplicado
        const clienteExistente = await Client.findOne({ email: emailLower });
        if (clienteExistente) {
            // ✅ SEGURIDAD (C6): No se logea el email para evitar exposición de datos personales
            return res.status(409).json({ 
                error: 'Este email ya está registrado. ¿Deseas iniciar sesión?' 
            });
        }

        // ✅ CREAR CLIENTE
        const nuevoCliente = new Client({
            nombre: nombreTrim,
            email: emailLower,
            password: password, // El pre-save hook lo hasheará
            whatsapp: whatsappClean,
            activo: true,
            ultimaActividad: new Date()
        });

        await nuevoCliente.save();

        // ✅ GENERAR TOKEN JWT
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        if (!secret) {
            logger.error('JWT_SECRET no configurado al crear cuenta de cliente');
            return res.status(500).json({ error: 'Error de configuración del servidor' });
        }

        const token = jwt.sign(
            { 
                id: nuevoCliente._id, 
                email: nuevoCliente.email,
                tipo: 'cliente'
            },
            secret,
            { expiresIn: '30d' }
        );

        // ✅ SEGURIDAD (C6): No se logea el email del nuevo cliente en producción

        res.status(201).json({
            exito: true,
            mensaje: 'Cuenta creada exitosamente',
            token,
            cliente: {
                _id: nuevoCliente._id,
                id: nuevoCliente._id,
                nombre: nuevoCliente.nombre,
                email: nuevoCliente.email,
                whatsapp: nuevoCliente.whatsapp,
                domicilio: nuevoCliente.domicilio || '',
                localidad: nuevoCliente.localidad || '',
                provincia: nuevoCliente.provincia || '',
                codigoPostal: nuevoCliente.codigoPostal || ''
            }
        });

    } catch (error) {
        logger.error('Error en registro de cliente', { message: error.message });
        
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Este email ya está registrado' });
        }
        
        res.status(500).json({ error: 'Error al crear la cuenta. Intenta nuevamente.' });
    }
});

// ======== LOGIN DE CLIENTE ========
// Verifica credenciales y devuelve un token JWT si son correctas.
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // Seleccionar explícitamente el password ya que el esquema lo marca con select: false
        // También traemos loginAttempts y lockUntil para la protección contra intentos repetidos
        const cliente = await Client.findOne({ email: email.toLowerCase() }).select('+password +loginAttempts +lockUntil');
        
        // ✅ SEGURIDAD (C6): No se logea el email ni el estado de la validación de password (OWASP).
        // Verbosidad eliminada para no exponer flujo de autenticación en los logs.
        if (!cliente) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // ✅ M4: Verificar si la cuenta está temporalmente bloqueada por demasiados intentos fallidos.
        // El modelo bloquea la cuenta por 2 horas después de 5 intentos incorrectos.
        // ¿La cuenta no se desbloquea? Revisa isLocked() en models/Client.js
        if (cliente.isLocked()) {
            return res.status(423).json({ 
                error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intentá nuevamente más tarde.' 
            });
        }

        // Clientes antiguos podrían no tener contraseña establecida
        if (!cliente.password) {
            return res.status(400).json({ error: 'La cuenta no tiene contraseña configurada' });
        }

        const passwordValido = await bcrypt.compare(password, cliente.password);
        if (!passwordValido) {
            // ✅ M4: Registrar el intento fallido para el sistema de bloqueo automático
            await cliente.incLoginAttempts();
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!cliente.activo) {
            return res.status(403).json({ error: 'Esta cuenta está desactivada' });
        }

        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        if (!secret) {
            logger.error('JWT_SECRET no configurado al hacer login de cliente');
            return res.status(500).json({ error: 'Configuración del servidor inválida' });
        }

        const token = jwt.sign({ id: cliente._id, email: cliente.email, tipo: 'cliente' }, secret, { expiresIn: '30d' });

        cliente.ultimaActividad = new Date();
        await cliente.save();

        // ✅ M4: Inicio de sesión exitoso — resetear el contador de intentos fallidos
        await cliente.resetLoginAttempts();

        return res.json({
            exito: true,
            mensaje: 'Inicio de sesión exitoso',
            token,
            cliente: {
                _id: cliente._id,
                id: cliente._id,
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                domicilio: cliente.domicilio || cliente.direccion,
                localidad: cliente.localidad || cliente.ciudad,
                provincia: cliente.provincia || '',
                codigoPostal: cliente.codigoPostal
            }
        });

    } catch (error) {
        logger.error('Error en login de cliente', { message: error.message });
        return res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
});

// ======== CONSULTAR PERFIL ========
// Devuelve los datos del cliente identificado por su token JWT.
router.get('/perfil', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        // Verificar token
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        const decoded = jwt.verify(token, secret);

        // Buscar cliente
        const cliente = await Client.findById(decoded.id).select('-password');
        
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({
            exito: true,
            mensaje: 'Perfil obtenido',
            cliente: {
                _id: cliente._id,
                id: cliente._id,
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                domicilio: cliente.domicilio || cliente.direccion,
                localidad: cliente.localidad || cliente.ciudad,
                provincia: cliente.provincia || '',
                codigoPostal: cliente.codigoPostal
            }
        });

    } catch (error) {
        logger.warn('Error verificando token en /perfil', { message: error.message });
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
});

// ======== ACTUALIZAR PERFIL ========
// Permite al cliente cambiar su nombre, whatsapp y dirección.
router.put('/perfil', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        // Verificar token
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        const decoded = jwt.verify(token, secret);

        // Actualizar datos del cliente
        const { nombre, whatsapp, domicilio, localidad, provincia, direccion, ciudad, codigoPostal } = req.body;

        // ======== VALIDACIÓN DE DATOS PERSONALES ========
        // Si el cliente envía un nombre, verificar que no esté vacío ni sea muy corto
        if (nombre !== undefined) {
            const nombreLimpio = (typeof nombre === 'string') ? nombre.trim() : '';
            if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
                return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres' });
            }
        }
        // Si el cliente envía whatsapp, verificar que tenga formato válido (solo dígitos, 7-15 caracteres)
        if (whatsapp !== undefined && whatsapp !== null && whatsapp !== '') {
            const whatsappLimpio = String(whatsapp).replace(/\D/g, '');
            if (whatsappLimpio.length < 7 || whatsappLimpio.length > 15) {
                return res.status(400).json({ error: 'El número de WhatsApp debe tener entre 7 y 15 dígitos' });
            }
        }
        // ¿Perfil no se actualiza? Revisar este bloque de validación o decoded.id

        const cliente = await Client.findByIdAndUpdate(
            decoded.id,
            {
                nombre,
                whatsapp,
                domicilio,
                localidad,
                provincia,
                codigoPostal
            },
            { new: true }
        ).select('-password');

        res.json({
            exito: true,
            mensaje: 'Perfil actualizado',
            cliente: {
                _id: cliente._id,
                id: cliente._id,
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                domicilio: cliente.domicilio || cliente.direccion,
                localidad: cliente.localidad || cliente.ciudad,
                provincia: cliente.provincia || '',
                codigoPostal: cliente.codigoPostal
            }
        });

    } catch (error) {
        logger.error('Error actualizando perfil de cliente', { message: error.message });
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// ======== ACTUALIZAR DIRECCIÓN ========
// Actualiza solo los campos de dirección de envío del cliente.
router.put('/direccion', async (req, res) => {
    try {
        // Verificar token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;

        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const { domicilio, localidad, provincia, direccion, ciudad, codigoPostal } = req.body;

        // ======== VALIDACIÓN DE DIRECCIÓN ========
        // Normalizar: quitar espacios y convertir a string
        const domicilioFinal = (domicilio || direccion || '').trim();
        const localidadFinal = (localidad || ciudad || '').trim();
        const codigoPostalFinal = (codigoPostal || '').toString().trim();

        // Verificar que los campos requeridos no estén vacíos
        if (!domicilioFinal) {
            return res.status(400).json({ error: 'El domicilio es requerido' });
        }
        if (domicilioFinal.length < 5 || domicilioFinal.length > 200) {
            return res.status(400).json({ error: 'El domicilio debe tener entre 5 y 200 caracteres' });
        }
        if (!localidadFinal) {
            return res.status(400).json({ error: 'La localidad es requerida' });
        }
        if (localidadFinal.length < 2 || localidadFinal.length > 100) {
            return res.status(400).json({ error: 'La localidad debe tener entre 2 y 100 caracteres' });
        }
        if (!codigoPostalFinal) {
            return res.status(400).json({ error: 'El código postal es requerido' });
        }
        // El código postal argentino puede ser numérico (4 dígitos) o alfanumérico (ej: B1900)
        if (!/^\w{3,10}$/.test(codigoPostalFinal)) {
            return res.status(400).json({ error: 'El código postal no tiene un formato válido (3-10 caracteres alfanuméricos)' });
        }
        // ¿Error de validación de dirección? Revisar este bloque de validación

        // Buscar y actualizar cliente
        const cliente = await Client.findById(decoded.id).select('-password');
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Guardar campos normalizados y validados
        cliente.domicilio = domicilioFinal;
        cliente.localidad = localidadFinal;
        if (provincia) cliente.provincia = String(provincia).trim().substring(0, 100);
        cliente.codigoPostal = codigoPostalFinal;
        
        await cliente.save();

        res.json({

            exito: true,
            mensaje: 'Dirección actualizada correctamente',
            cliente: {
                _id: cliente._id,
                id: cliente._id,
                nombre: cliente.nombre,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                domicilio: cliente.domicilio || cliente.direccion,
                localidad: cliente.localidad || cliente.ciudad,
                provincia: cliente.provincia || '',
                codigoPostal: cliente.codigoPostal
            }
        });

    } catch (error) {
        logger.error('Error actualizando dirección de cliente', { message: error.message });
        res.status(500).json({ error: 'Error al actualizar dirección' });
    }
});

export default router;
