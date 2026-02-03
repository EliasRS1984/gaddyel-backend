import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoSanitize from 'express-mongo-sanitize';
import { conectarDB } from "./config/db.js";
import { validateEnv } from "./config/validateEnv.js";
import logger from "./utils/logger.js";
import productoRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";

import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminProductosRoutes from "./routes/adminProductosRoutes.js";
import adminClientesRoutes from "./routes/adminClientesRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import mercadoPagoRoutes from "./routes/mercadoPagoRoutes.js";
import mercadoPagoWebhookRoutes from "./routes/mercadoPagoWebhookRoutes.js";
import clientAuthRoutes from "./routes/clientAuthRoutes.js";
import carouselRoutes from "./routes/carouselRoutes.js";
import paymentConfigRoutes from "./routes/paymentConfig.js";
import systemConfigRoutes from "./routes/systemConfig.js";

import { applySecurity } from "./middleware/security.js"; 
import { errorHandler } from "./middleware/errorHandler.js";
import verifyToken from "./middleware/authMiddleware.js";
import cookieParser from 'cookie-parser';

dotenv.config();
// redeploy trigger: update CORS config timestamp

// ✅ Validar variables de entorno al inicio
validateEnv();

const app = express();
app.set('trust proxy', 1);

/**
 * ✅ CORS MEJORADO - Whitelist dinámico para Vercel + env vars
 * 
 * FLUJO:
 * - Desarrollo: localhost + ngrok/localtunnel
 * - Producción: URLs dinámicas de Vercel + ALLOWED_ORIGINS env var
 * 
 * NOTA: Vercel asigna URLs dinámicas durante deployments (con hash de deploy)
 * Por eso aceptamos cualquier subdominio de vercel.app
 */
const getAllowedOrigins = () => {
    const baseOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
    ];

    // Fallback para producción (Vercel - con soporte para URLs dinámicas)
    const productionFrontends = [
        'https://gaddyel.vercel.app',
        'https://proyecto-gaddyel.vercel.app', // Dominio antiguo (redirecciona automáticamente)
        // Nota: URLs dinámicas de Vercel se validan con regex en cors()
    ];

    // Agregar URLs de túneles si existen en .env
    if (process.env.FRONTEND_URL) {
        baseOrigins.push(process.env.FRONTEND_URL);
    }

    // En producción, agregar ALLOWED_ORIGINS desde env vars
    if (process.env.ALLOWED_ORIGINS) {
        const prodOrigins = process.env.ALLOWED_ORIGINS
            .split(',')
            .map(o => o.trim())
            .filter(o => o.length > 0);
        return baseOrigins.concat(productionFrontends, prodOrigins);
    }

    return baseOrigins.concat(productionFrontends);
};

/**
 * ⚠️ WEBHOOK DE MERCADO PAGO - PRIMERA RUTA (ANTES DE TODOS LOS MIDDLEWARE)
 * 
 * CRÍTICO: El webhook debe estar ANTES de:
 * - mongoSanitize (bloquea parámetros especiales de MP)
 * - express.json() (necesita raw body para HMAC)
 * - Cualquier sanitización
 * 
 * ✅ RUTA NUEVA: /api/webhooks/mercadopago
 * Procesa notificaciones de Mercado Pago y actualiza estadoPago
 * 
 * ❌ RUTA VIEJA: /api/mercadopago/webhook - DESCONTINUADA
 */
app.use("/api/webhooks", mercadoPagoWebhookRoutes);

const allowedOrigins = getAllowedOrigins();

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (Postman, mobile apps, etc)
        if (!origin) {
            return callback(null, true);
        }
        
        // ✅ En desarrollo, permitir cualquier localhost
        if (process.env.NODE_ENV !== 'production') {
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
        }

        // ✅ Permitir túneles (ngrok, localtunnel) en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            if (origin.includes('.ngrok') || origin.includes('.loca.lt') || origin.includes('ngrok-free.dev')) {
                return callback(null, true);
            }
        }
        
        // ✅ Whitelist estricta (desarrollo y producción)
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // ✅ DINÁMICO: Aceptar cualquier subdomain *.vercel.app en producción
        // Vercel asigna URLs dinámicas con hash (proyecto-gaddyel-XXX.vercel.app)
        if (process.env.NODE_ENV === 'production' && origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        
        // ❌ RECHAZAR orígenes no autorizados
        logger.security(`CORS bloqueado: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// ✅ Parsers
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

// ✅ Sanitización NoSQL
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        // ✅ EXCLUIR webhooks de este logging (MP genera muchos intentos)
        if (!req.path.includes('/api/webhooks')) {
            logger.security(`Intento de NoSQL injection bloqueado`, { 
                ip: req?.ip, 
                key,
                path: req?.path 
            });
        }
    }
}));

// Seguridad (helmet, sanitizers, rate limits...)
const { loginLimiter } = applySecurity(app);

// Conexión DB
conectarDB();

/* ===== RUTAS PÚBLICAS ===== */
app.use("/api/productos", productoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/productos/seed", seedRoutes);
app.use("/api/carousel", carouselRoutes); // Carrusel de inicio
app.use("/api/auth", clientAuthRoutes); // Autenticación de clientes

// ENDPOINT DE PRUEBA - Verificar autenticación
app.get("/api/test/auth", (req, res) => {
    console.log('📨 GET /test/auth - Endpoint de prueba');
    console.log('   Headers:', req.headers);
    res.json({ ok: true, mensaje: 'Endpoint de prueba sin autenticación' });
});

// ✅ ENDPOINT DE DIAGNÓSTICO - Verificar variables de entorno
app.get("/api/diagnostico/env", (req, res) => {
    console.log('🔍 GET /diagnostico/env - Verificar variables de entorno');
    
    const diagnosis = {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
        MERCADO_PAGO_PUBLIC_KEY: process.env.MERCADO_PAGO_PUBLIC_KEY ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
        FRONTEND_URL: process.env.FRONTEND_URL || 'undefined',
        MONGODB_URI: process.env.MONGODB_URI ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
        JWT_SECRET: process.env.JWT_SECRET ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
        timestamp: new Date().toISOString()
    };
    
    console.log('📋 Diagnosis:', diagnosis);
    res.json(diagnosis);
});

app.get("/api/test/auth-protected", (req, res, next) => {
    console.log('📨 GET /test/auth-protected - Endpoint protegido de prueba');
    next();
}, verifyToken, (req, res) => {
    res.json({ ok: true, mensaje: 'Autenticación exitosa', usuario: req.user });
});

/* ===== RUTAS ADMIN ===== */
app.use("/api/admin/auth", adminAuthRoutes(loginLimiter)); // login con limiter
app.use("/api/admin/productos", adminProductosRoutes);     // CRUD protegido con verifyToken
app.use("/api/admin/clientes", adminClientesRoutes);       // Gestión de clientes CRM
app.use("/api/payment-config", paymentConfigRoutes);       // Configuración de comisiones (protegido)
app.use("/api/system-config", systemConfigRoutes);         // Configuración global del sistema (protegido)

/* ===== RUTAS PÚBLICAS E-COMMERCE ===== */
app.use("/api/pedidos", orderRoutes);                      // Crear pedidos (público) + listar (admin)
app.use("/api/mercadopago", mercadoPagoRoutes);            // Checkout Mercado Pago
// ✅ NOTA: /api/webhooks ya registrado al inicio (antes de sanitización)

/* ===== MIDDLEWARE GLOBAL DE ERRORES ===== */
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor funcionando en el puerto ${PORT}`));
