# Gaddyel Backend API

Backend para e-commerce Gaddyel con sistema de gestión de productos, órdenes, autenticación y pagos con Mercado Pago. 

**Stack**: Node.js 22 + Express + MongoDB + ES Modules  
**Seguridad**: OWASP 2025, JWT, bcrypt, rate limiting  
**Pagos**: Mercado Pago SDK v2.0+ con webhooks

---

## 📁 Estructura del Proyecto

```
gaddyel-backend/
├── src/                          # 🎯 Código fuente principal (ES Modules)
│   ├── index.js                  # Entry point del servidor
│   ├── config/                   # Configuraciones (DB, Cloudinary, JWT)
│   ├── controllers/              # Lógica de negocio por módulo
│   ├── models/                   # Schemas de MongoDB (Mongoose)
│   ├── routes/                   # Definición de endpoints
│   ├── middleware/               # Auth, validación, seguridad
│   ├── services/                 # Lógica compleja (MercadoPago, Orders)
│   ├── scripts/                  # Utilidades CLI (createAdmin, etc)
│   ├── utils/                    # Helpers (logger, etc)
│   └── validators/               # Validaciones de esquemas
├── Data/                         # JSON seeds para productos
├── logs/                         # Logs de aplicación (gitignored)
├── uploads/                      # Uploads temporales (gitignored)
├── archive/                      # Código legacy archivado (gitignored)
├── .env                          # Variables de entorno (gitignored)
├── .env.example                  # Template de variables
└── package.json                  # Dependencias y scripts
```

**✅ Arquitectura Limpia**: Solo carpeta `src/` con ES Modules, sin duplicaciones legacy.

---

## 🚀 Instalación Local

### Requisitos Previos
- Node.js v22+ (LTS recomendado)
- npm o yarn
- MongoDB Atlas (o local)
- Cloudinary (para imágenes)
- Mercado Pago (para pagos - opcional en dev)

### 1. Clonar e instalar
```bash
git clone https://github.com/tu-usuario/gaddyel-backend.git
cd gaddyel-backend
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

**Variables críticas**:
```env
# Base de datos
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/gaddyel

# JWT (genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=tu-jwt-secret-256-bits
JWT_REFRESH_SECRET=tu-refresh-secret-256-bits

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# Frontend (CORS)
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

# Mercado Pago (opcional - usar TEST credentials en desarrollo)
MERCADO_PAGO_ACCESS_TOKEN=TEST-tu-access-token
MERCADO_PAGO_PUBLIC_KEY=TEST-tu-public-key
MERCADO_PAGO_WEBHOOK_SECRET=tu-webhook-secret
```

### 3. Iniciar el servidor
```bash
npm run dev        # Desarrollo con nodemon
npm start          # Producción
```

El servidor estará en `http://localhost:5000`

### 4. (Opcional) Crear usuario administrador
```bash
npm run create-admin    # Sigue las instrucciones en consola
```

---

## 📡 Endpoints Principales

### Autenticación Admin
```
POST   /api/admin/auth/login          # Login admin
POST   /api/admin/auth/refresh        # Refresh token
POST   /api/admin/auth/logout         # Logout
```

### Autenticación Cliente
```
POST   /api/clientes/auth/registro    # Registro usuario
POST   /api/clientes/auth/login       # Login usuario
GET    /api/clientes/auth/perfil      # Perfil (requiere auth)
```

### Productos
```
GET    /api/productos                 # Listar productos
GET    /api/productos/:id             # Detalle producto
POST   /api/admin/productos           # Crear (admin)
PUT    /api/admin/productos/:id       # Actualizar (admin)
DELETE /api/admin/productos/:id       # Eliminar (admin)
```

### Órdenes
```
POST   /api/pedidos/crear             # Crear orden (público)
GET    /api/pedidos/cliente           # Órdenes del usuario (auth)
GET    /api/pedidos/:id               # Detalle orden
PUT    /api/pedidos/:id/estado        # Actualizar estado (admin)
```

### Mercado Pago
```
POST   /api/mercadopago/preference    # Crear preferencia de pago
GET    /api/mercadopago/payment/:id   # Info de pago
POST   /api/webhooks/mercadopago      # Webhook (interno)
```

### Uploads
```
POST   /api/upload                    # Subir imagen (admin)
```

**Documentación completa**: Ver `COPILOT_DOCUMENTATION.md` y `FLUJO_DATOS.md`

---

## 🧪 Scripts Disponibles

```bash
npm run dev              # Desarrollo con nodemon
npm start                # Producción
npm run create-admin     # Crear usuario admin CLI
npm run list-admins      # Listar admins existentes
npm run change-password  # Cambiar contraseña admin
```

---

## 🔐 Seguridad Implementada

- ✅ **Helmet**: Headers de seguridad HTTP
- ✅ **CORS**: Whitelist de orígenes permitidos
- ✅ **Rate Limiting**: express-rate-limit (previene DDoS)
- ✅ **NoSQL Injection**: express-mongo-sanitize
- ✅ **JWT**: Tokens con expiración (15min access, 7d refresh)
- ✅ **bcrypt**: Hashing de contraseñas (12 rounds)
- ✅ **Validación**: express-validator en todos los endpoints
- ✅ **HMAC-SHA256**: Validación de webhooks Mercado Pago
- ✅ **Idempotency Keys**: Prevención de cargos duplicados

---

## 🌐 Despliegue en Producción

### Vercel (Recomendado)
1. Conectar repositorio en Vercel
2. Configurar variables de entorno en dashboard
3. Asegurar `vercel.json` esté configurado:
```json
{
  "version": 2,
  "builds": [{ "src": "src/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.js" }]
}
```

### Render / Railway
Similar a Vercel, configurar:
- Node.js 22
- Build command: `npm install`
- Start command: `npm start`
- Variables de entorno según `.env.example`

**⚠️ Importante**: En producción usar credenciales PRODUCTION de Mercado Pago.

---

## 📚 Documentación Adicional

- [COPILOT_DOCUMENTATION.md](COPILOT_DOCUMENTATION.md) - Guía de desarrollo
- [FLUJO_DATOS.md](FLUJO_DATOS.md) - Flujo de datos de la aplicación
- [MERCADO_PAGO_CONFIG.md](../MERCADO_PAGO_CONFIG.md) - Setup de pagos completo

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| Runtime | Node.js | 22+ |
| Framework | Express | 4.x |
| Base de Datos | MongoDB | 6.x (Atlas) |
| ODM | Mongoose | 8.x |
| Autenticación | jsonwebtoken | 9.x |
| Seguridad | bcryptjs, helmet, cors | Latest |
| Validación | express-validator | 7.x |
| Storage | Cloudinary | Latest |
| Pagos | Mercado Pago SDK | 2.0+ |
| Rate Limiting | express-rate-limit | 7.x |
| Sanitización | express-mongo-sanitize | 2.x |

---

## 📞 Soporte

- Issues: GitHub Issues
- Email: soporte@gaddyel.com
- Docs: Ver carpeta de documentación

---

## ✅ Estado del Proyecto

**Versión**: 1.0.0  
**Estado**: ✅ Producción Ready  
**Última actualización**: Diciembre 2025  

**Features completadas**:
- ✅ CRUD de productos con variantes
- ✅ Autenticación dual (Admin + Cliente)
- ✅ Sistema de órdenes completo
- ✅ Integración Mercado Pago con webhooks
- ✅ Cloudinary para imágenes
- ✅ Seguridad OWASP 2025
- ✅ Rate limiting y sanitización
- ✅ Logging estructurado

**Arquitectura limpia**: Sin código legacy, solo ES Modules en `src/`.
````
│   └── cloudinary.js    # Configuración Cloudinary
├── controllers/
│   ├── productController.js    # Lógica de productos
│   ├── adminAuthController.js  # Autenticación
│   └── seedController.js       # Datos de prueba
├── routes/
│   ├── productRoutes.js        # Rutas públicas
│   ├── adminProductosRoutes.js # Rutas admin (protegidas)
│   ├── adminAuthRoutes.js      # Autenticación
│   ├── uploadRoutes.js         # Subida de imágenes
│   └── seedRoutes.js           # Datos iniciales
├── middleware/
│   ├── authMiddleware.js    # Verificación JWT
│   ├── errorHandler.js      # Manejo de errores
│   ├── security.js          # Seguridad (helmet, rate limit)
│   ├── upload.js            # Multer local
│   └── uploadCloudinary.js  # Multer + Cloudinary
├── models/
│   ├── Product.js      # Esquema de producto
│   ├── Admin.js        # Esquema de administrador
│   └── RefreshToken.js # Esquema de refresh token
└── validators/
    └── productValidator.js # Esquemas Joi
```

---

## 🔐 Autenticación

### Login
```bash
POST /api/admin/auth/login
Content-Type: application/json

{
  "usuario": "Elias",
  "contraseña": "Callao1929"
}
```

**Respuesta exitosa (200):**
```json
{
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "_id": "...",
    "usuario": "Elias"
  }
}
```

### Refresh Token
```bash
POST /api/admin/auth/refresh
Authorization: Bearer <refreshToken>
```

### Logout
```bash
POST /api/admin/auth/logout
Authorization: Bearer <token>
```

---

## 📦 API Endpoints

### Productos (Públicos)
- `GET /api/productos` - Obtener todos
- `GET /api/productos/:id` - Obtener por ID
- `GET /api/productos/destacados/lista` - Obtener destacados

### Productos (Admin - Protegidos)
- `POST /api/admin/productos` - Crear producto
- `PUT /api/admin/productos/:id` - Editar producto
- `DELETE /api/admin/productos/:id` - Eliminar producto

### Upload
- `POST /api/upload` - Subir imagen a Cloudinary

### Datos Iniciales (Desarrollo)
- `GET /api/seed` - Poblar BD con datos de prueba

---

## 🔑 Variables de Entorno

```env
# Base de Datos
MONGO_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/db-name

# Servidor
PORT=5000
NODE_ENV=development

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Autenticación
JWT_SECRET=tu_secret_muy_largo_y_seguro
REFRESH_TOKEN_EXP_DAYS=30

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## 🧪 Testing

### Credenciales de Prueba
- **Usuario:** `Elias`
- **Contraseña:** `Callao1929`

### Crear Producto
```bash
POST /api/admin/productos
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "Collar de Plata",
  "descripcion": "Elegante collar",
  "precio": 99.99,
  "cantidadUnidades": 10,
  "categoria": "Accesorios",
  "material": "Plata",
  "imagenSrc": "https://...",
  "imagenes": ["https://...", "https://..."],
  "destacado": false
}
```

**Validaciones:**
- `precio` > 0 (requerido)
- `cantidadUnidades` >= 0
- `nombre` no vacío (requerido)
- `imagenes` filtradas de nulls

---

## 🚀 Despliegue en Vercel

### Pasos para Desplegar

1. **Crear cuenta en Vercel** (si no tienes)
   - https://vercel.com

2. **Push a GitHub**
   ```bash
   git remote add origin https://github.com/tu-usuario/gaddyel-backend.git
   git push -u origin main
   ```

3. **Conectar Vercel a GitHub**
   - Ir a https://vercel.com/new
   - Seleccionar el repositorio
   - Vercel detectará `vercel.json` automáticamente

4. **Configurar Variables de Entorno en Vercel**
   - En la interfaz de Vercel, ve a **Settings** → **Environment Variables**
   - Agrega cada variable de `.env`:
     - `MONGO_URI`
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`
     - `JWT_SECRET`
     - `REFRESH_TOKEN_EXP_DAYS`

5. **Deploy**
   - Vercel deployará automáticamente
   - Tu URL será algo como: `https://gaddyel-backend.vercel.app`

### Post-Despliegue

Después de desplegar en Vercel:

1. **Actualizar URL del Frontend**
   - En `src/api/axios.js` del frontend:
   ```javascript
   const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://gaddyel-backend.vercel.app';
   ```

2. **Actualizar CORS en Backend**
   - Si el frontend está en Vercel, actualiza la variable `FRONTEND_URL`
   - Ej: `https://gaddyel-frontend.vercel.app`

3. **Probar Endpoints**
   ```bash
   # Login
   curl -X POST https://gaddyel-backend.vercel.app/api/admin/auth/login \
     -H "Content-Type: application/json" \
     -d '{"usuario":"Elias","contraseña":"Callao1929"}'

   # Ver productos
   curl https://gaddyel-backend.vercel.app/api/productos
   ```

---

## 🐛 Troubleshooting

### "Error: Cannot find module"
```bash
# Solución
rm -rf node_modules package-lock.json
npm install
```

### "MongoError: Authentication failed"
- Verifica que `MONGO_URI` sea correcto
- Verifica IP whitelist en MongoDB Atlas

### "Cloudinary Error"
- Verifica credenciales de Cloudinary
- Verifica que `CLOUDINARY_CLOUD_NAME` sea correcto

### "JWT not valid"
- Verifica que el token no haya expirado
- Usa endpoint `/api/admin/auth/refresh` para refrescar

---

## 📝 Logs de Desarrollo

El servidor muestra logs con:
- ✅ Servidor corriendo en puerto X
- ✅ Conectado a MongoDB correctamente
- 🔄 nodemon: restarting (cuando hay cambios)

---

## 🔒 Seguridad

- **CORS:** Solo acepta peticiones del frontend configurado
- **Helmet:** Protege contra vulnerabilidades comunes
- **Rate Limiting:** Máximo 100 peticiones por minuto
- **Sanitización:** Protección contra NoSQL injection
- **JWT:** Tokens con expiración y refresh
- **Bcrypt:** Contraseñas hasheadas

---

## 📦 Dependencias Principales

- **express** - Framework web
- **mongoose** - ODM para MongoDB
- **jsonwebtoken** - Autenticación JWT
- **cloudinary** - Almacenamiento de imágenes
- **multer** - Procesamiento de archivos
- **helmet** - Seguridad
- **cors** - Control de origen cruzado

---

## 📞 Soporte

Para reportar bugs o sugerir features, abre un issue en GitHub.

---

## 📄 Licencia

ISC

---

**Última actualización:** 27 de noviembre de 2025
