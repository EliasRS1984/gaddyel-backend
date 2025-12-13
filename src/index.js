import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { conectarDB } from "./config/db.js";
import { validateEnv } from "./config/validateEnv.js";
import productoRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";

import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminProductosRoutes from "./routes/adminProductosRoutes.js";
import adminClientesRoutes from "./routes/adminClientesRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import mercadoPagoRoutes from "./routes/mercadoPagoRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import clientAuthRoutes from "./routes/clientAuthRoutes.js";

import { applySecurity } from "./middleware/security.js"; 
import { errorHandler } from "./middleware/errorHandler.js";
import verifyToken from "./middleware/authMiddleware.js";
import cookieParser from 'cookie-parser';

dotenv.config();

// ✅ Validar variables de entorno al inicio
validateEnv();

const app = express();

// CORS
app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, postman, etc)
        if (!origin) {
            return callback(null, true);
        }
        
        // En desarrollo, permitir cualquier puerto localhost
        if (process.env.NODE_ENV === 'development') {
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
        }
        
        // En producción O desarrollo: permitir localhost con múltiples puertos + dominios configurados
        const allowedOrigins = [
            'http://localhost:5173',      // Desarrollo local Vite (puerto predeterminado)
            'http://localhost:5174',      // Vite segundo puerto (cuando 5173 está ocupado)
            'http://localhost:5175',      // Vite tercer puerto
            'http://localhost:5176',      // Vite cuarto puerto
            'http://localhost:3000',      // React alt port
            'http://127.0.0.1:5173',      // Localhost IP alternativo
            'http://127.0.0.1:5174',      // Localhost IP alternativo
        ];
        
        // Agregar dominios desde variable de entorno si existen
        if (process.env.ALLOWED_ORIGINS) {
            allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
        }
        
        // En producción, permitir cualquier origen (más flexible)
        if (process.env.NODE_ENV === 'production') {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        console.warn(`⚠️  CORS rechazado para origen: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// cookies
app.use(cookieParser());

// Seguridad (helmet, sanitizers, rate limits...)
const { loginLimiter } = applySecurity(app);

// Conexión DB
conectarDB();

/* ===== RUTAS PÚBLICAS ===== */
app.use("/api/productos", productoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/productos/seed", seedRoutes);
app.use("/api/auth", clientAuthRoutes); // Autenticación de clientes

// ENDPOINT DE PRUEBA - Verificar autenticación
app.get("/api/test/auth", (req, res) => {
    console.log('📨 GET /test/auth - Endpoint de prueba');
    console.log('   Headers:', req.headers);
    res.json({ ok: true, mensaje: 'Endpoint de prueba sin autenticación' });
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

/* ===== RUTAS PÚBLICAS E-COMMERCE ===== */
app.use("/api/pedidos", orderRoutes);                      // Crear pedidos (público) + listar (admin)
app.use("/api/mercadopago", mercadoPagoRoutes);            // Checkout Mercado Pago + webhooks

/* ===== MIDDLEWARE GLOBAL DE ERRORES ===== */
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor funcionando en el puerto ${PORT}`));
