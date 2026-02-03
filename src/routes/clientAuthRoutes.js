import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Client from '../models/Client.js';

const router = express.Router();

/**
 * ✅ POST /api/auth/registro - Registro de nuevo cliente
 * OPTIMIZADO 2026: Validaciones robustas de seguridad
 * Body: { nombre, email, password, whatsapp }
 */
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
            console.log(`⚠️ Intento de registro con email existente: ${emailLower}`);
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
            console.error('❌ JWT_SECRET no configurado');
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

        console.log('✅ Cliente registrado exitosamente:', nuevoCliente.email);

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
        console.error('❌ Error en registro:', error.message);
        console.error('   Stack:', error.stack);
        
        // Manejo específico de errores de MongoDB
        if (error.code === 11000) {
            return res.status(409).json({ 
                error: 'Este email ya está registrado' 
            });
        }
        
        res.status(500).json({ 
            error: 'Error al crear la cuenta. Intenta nuevamente.' 
        });
    }
});

/**
 * POST /api/auth/login - Login de cliente
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // Seleccionar explícitamente el password ya que el esquema lo marca con select: false
        const cliente = await Client.findOne({ email: email.toLowerCase() }).select('+password');
        
        console.log(`🔐 [LOGIN] Intento de login para: ${email}`);
        console.log(`  - Cliente encontrado: ${!!cliente}`);
        console.log(`  - Cliente tiene password: ${!!cliente?.password}`);
        console.log(`  - Password es string: ${typeof cliente?.password === 'string'}`);
        console.log(`  - Password length: ${cliente?.password?.length || 0}`);
        
        if (!cliente) {
            console.log(`  ❌ Usuario no encontrado`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Clientes antiguos podrían no tener contraseña establecida (o no recuperada)
        if (!cliente.password) {
            console.log(`  ❌ Usuario sin contraseña configurada`);
            return res.status(400).json({ error: 'La cuenta no tiene contraseña configurada' });
        }

        const passwordValido = await bcrypt.compare(password, cliente.password);
        console.log(`  - Comparación de password: ${passwordValido ? 'VÁLIDO ✅' : 'INVÁLIDO ❌'}`);
        
        if (!passwordValido) {
            console.log(`  ❌ Credenciales inválidas (contraseña no coincide)`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!cliente.activo) {
            console.log(`  ❌ Cuenta desactivada`);
            return res.status(403).json({ error: 'Esta cuenta está desactivada' });
        }

        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        if (!secret) {
            console.error('❌ JWT secret no configurado');
            return res.status(500).json({ error: 'Configuración del servidor inválida' });
        }

        const token = jwt.sign({ id: cliente._id, email: cliente.email, tipo: 'cliente' }, secret, { expiresIn: '30d' });

        cliente.ultimaActividad = new Date();
        await cliente.save();

        console.log(`✅ Cliente inició sesión correctamente: ${cliente.email}`);

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
        console.error('❌ Error en login:', error);
        // Evitar 500 genérico si podemos identificar el problema
        return res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
});

/**
 * GET /api/auth/perfil - Obtener perfil del cliente autenticado
 * Requiere token JWT en header Authorization
 */
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
        console.error('❌ Error obteniendo perfil:', error.message);
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
});

/**
 * PUT /api/auth/perfil - Actualizar perfil del cliente
 */
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
        
        const cliente = await Client.findByIdAndUpdate(
            decoded.id,
            {
                nombre,
                whatsapp,
                domicilio,
                localidad,
                provincia,
                // mantener compatibilidad si se envían campos legacy
                direccion,
                ciudad,
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
        console.error('❌ Error actualizando perfil:', error.message);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

/**
 * PUT /api/auth/direccion - Actualizar solo dirección del cliente
 */
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

        // Validación
        if (!(domicilio || direccion) || !(localidad || ciudad) || !codigoPostal) {
            return res.status(400).json({ 
                error: 'Domicilio/di­rección, localidad/ciudad y código postal son requeridos' 
            });
        }

        // Buscar y actualizar cliente
        const cliente = await Client.findById(decoded.id).select('-password');
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Nuevos campos preferidos
        if (domicilio) cliente.domicilio = domicilio;
        if (localidad) cliente.localidad = localidad;
        if (provincia) cliente.provincia = provincia;
        // Compatibilidad legacy
        if (direccion) cliente.direccion = direccion;
        if (ciudad) cliente.ciudad = ciudad;
        cliente.codigoPostal = codigoPostal;
        
        await cliente.save();

        console.log('✅ Dirección actualizada para:', cliente.email);

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
        console.error('❌ Error actualizando dirección:', error.message);
        res.status(500).json({ error: 'Error al actualizar dirección' });
    }
});

export default router;
