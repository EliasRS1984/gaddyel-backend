# Gaddyel Backend API

Backend para la plataforma de administración de productos Gaddyel. Construido con Node.js, Express, MongoDB y Cloudinary.

---

## 📋 Características

- ✅ **Autenticación JWT** con refresh tokens
- ✅ **CRUD de Productos** completo con validaciones
- ✅ **Subida de imágenes** a Cloudinary
- ✅ **Base de datos MongoDB** con Mongoose
- ✅ **Seguridad** con helmet, rate limiting y sanitización
- ✅ **Manejo de errores** centralizado
- ✅ **CORS** configurado para frontend

---

## 🚀 Instalación Local

### Requisitos Previos
- Node.js v16+ instalado
- npm o yarn
- Cuenta de MongoDB Atlas
- Cuenta de Cloudinary

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/gaddyel-backend.git
cd gaddyel-backend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus variables:
# - MONGO_URI (tu string de conexión MongoDB)
# - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
# - JWT_SECRET (genera uno con: openssl rand -hex 64)
```

### 4. Iniciar el servidor en desarrollo
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:5000`

---

## 📊 Estructura del Proyecto

```
src/
├── index.js              # Punto de entrada
├── config/
│   ├── db.js            # Conexión MongoDB
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
