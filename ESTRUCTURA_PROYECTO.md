# Estructura del Proyecto Gaddyel Backend

## Descripción General
Backend de un catálogo de productos con autenticación de administrador, gestión de imágenes en Cloudinary y base de datos MongoDB.

---

## Estructura de Carpetas y Archivos

```
gaddyel-backend/
│
├── 📄 importarProductos.js          # Script para importar productos
├── 📄 package.json                  # Dependencias y configuración de npm
├── 📄 package-lock.json             # Versiones bloqueadas de dependencias
│
├── 📁 Data/
│   └── 📄 productos.json            # Datos de productos (JSON estático)
│
├── 📁 src/                          # Código fuente principal
│   │
│   ├── 📄 index.js                  # Punto de entrada de la aplicación
│   │
│   ├── 📁 config/                   # Configuración de servicios
│   │   ├── 📄 cloudinary.js         # Configuración de Cloudinary
│   │   └── 📄 db.js                 # Configuración de conexión MongoDB
│   │
│   ├── 📁 controllers/              # Lógica de negocio
│   │   ├── 📄 productController.js  # Controlador de productos
│   │   └── 📄 seedController.js     # Controlador para datos de prueba
│   │
│   ├── 📁 middleware/               # Middlewares Express
│   │   ├── 📄 authMiddleware.js     # Verificación de JWT
│   │   ├── 📄 errorHandler.js       # Manejo centralizado de errores
│   │   ├── 📄 security.js           # Seguridad (helmet, rate-limiting, etc)
│   │   ├── 📄 upload.js             # Configuración de multer (local)
│   │   └── 📄 uploadCloudinary.js   # Configuración de multer + Cloudinary
│   │
│   ├── 📁 models/                   # Esquemas Mongoose
│   │   ├── 📄 Admin.js              # Modelo de Usuario Admin
│   │   └── 📄 Product.js            # Modelo de Producto
│   │
│   ├── 📁 routes/                   # Definición de rutas
│   │   ├── 📄 adminAuthRoutes.js    # Rutas de autenticación admin
│   │   ├── 📄 adminProductosRoutes.js # Rutas CRUD de productos (admin)
│   │   ├── 📄 productRoutes.js      # Rutas públicas de productos
│   │   ├── 📄 seedRoutes.js         # Rutas para popular BD
│   │   └── 📄 uploadRoutes.js       # Rutas de carga de archivos
│   │
│   └── 📁 validators/               # Validación de datos
│       └── 📄 productValidator.js   # Esquemas Joi para productos
│
├── 📁 uploads/                      # Carpeta para archivos subidos localmente
│
└── 📁 node_modules/                 # Dependencias instaladas (npm)

```

---

## Resumen de Archivos Principales

### Archivos Raíz
| Archivo | Descripción |
|---------|-------------|
| `importarProductos.js` | Script para importar productos desde JSON |
| `package.json` | Definición de proyecto y dependencias |

### Archivos de Configuración (`src/config/`)
| Archivo | Descripción |
|---------|-------------|
| `cloudinary.js` | Configuración de Cloudinary para almacenamiento de imágenes |
| `db.js` | Conexión a MongoDB |

### Controladores (`src/controllers/`)
| Archivo | Descripción |
|---------|-------------|
| `productController.js` | **6 funciones principales:**<br/>✅ `obtenerProductos()` - GET todos (público)<br/>✅ `obtenerProductoPorId(id)` - GET por ID (público)<br/>✅ `crearProducto()` - POST con validaciones (precio > 0, stock >= 0, null filtering)<br/>✅ `editarProducto()` - PUT con mismas validaciones<br/>✅ `eliminarProducto()` - DELETE producto<br/>✅ `obtenerProductosDestacados()` - GET destacados |
| `authController.js` | Lógica de autenticación (login, logout, refresh token) |

### Middlewares (`src/middleware/`)
| Archivo | Descripción |
|---------|-------------|
| `authMiddleware.js` | Verifica tokens JWT en rutas protegidas |
| `errorHandler.js` | Manejo centralizado de errores |
| `security.js` | Seguridad global (helmet, XSS, rate-limiting) |
| `upload.js` | Configuración de multer para upload local |
| `uploadCloudinary.js` | Configuración de multer + Cloudinary |

### Modelos (`src/models/`)
| Archivo | Descripción |
|---------|-------------|
| `Admin.js` | Esquema: usuario (email), contraseña (bcrypt), roles |
| `Product.js` | Esquema: nombre, descripción, precio, stock/cantidadUnidades, imagenSrc, imagenes[], destacado, estado |

### Rutas (`src/routes/`)
| Archivo | Descripción |
|---------|-------------|
| `adminAuthRoutes.js` | POST `/api/admin/auth/login` - Autenticación<br/>POST `/api/admin/auth/logout` - Cerrar sesión<br/>POST `/api/admin/auth/refresh` - Refrescar token |
| `adminProductosRoutes.js` | GET `/api/admin/productos` - Todos (protegido)<br/>POST `/api/admin/productos` - Crear (protegido, validaciones)<br/>PUT `/api/admin/productos/:id` - Editar (protegido, validaciones)<br/>DELETE `/api/admin/productos/:id` - Eliminar (protegido) |
| `productRoutes.js` | GET `/api/productos` - Todos (público)<br/>GET `/api/productos/:id` - Por ID (público)<br/>GET `/api/productos/destacados/lista` - Destacados (público) |
| `uploadRoutes.js` | POST `/api/upload` - Subir archivo a Cloudinary (protegido) |
| `seedRoutes.js` | GET `/api/seed` - Popular BD con datos iniciales |

### Validadores (`src/validators/`)
| Archivo | Descripción |
|---------|-------------|
| `productValidator.js` | Esquemas Joi para validación de productos |

---

## Flujo de Autenticación (JWT)

**Login:**
1. POST `/api/admin/auth/login` con `{ usuario, contraseña }`
2. Backend verifica credenciales en BD
3. Genera JWT (token de acceso) y envía al cliente
4. Cliente almacena token en `localStorage`

**Rutas Protegidas:**
1. `authMiddleware.js` extrae token de header `Authorization: Bearer <token>`
2. Verifica validez del token
3. Si expira → cliente solicita refresh (`/refresh`)
4. Si válido → permite acceso a ruta

**Credenciales de Test:**
- Usuario: `Elias`
- Contraseña: `Callao1929`

---

## Flujo de Creación/Edición de Productos

**Frontend:**
1. Usuario completa formulario (nombre, precio, stock, imágenes)
2. Frontend valida localmente (precio > 0, stock >= 0)
3. Envía POST `/api/admin/productos` con token JWT

**Backend:**
1. `authMiddleware` valida token
2. `productController.crearProducto()` ejecuta:
   - Validación de tipos y rangos
   - Filtrado de nulls en imagenes
   - Conversión de tipos booleanos
   - Creación en MongoDB
3. Responde con producto creado o error

**Imágenes:**
- Cliente sube a Cloudinary vía POST `/api/upload`
- Backend retorna URL
- URL se guarda en `imagenSrc` (principal) e `imagenes[]` (galería)

---

## Validaciones Implementadas

### Backend Validations (`src/controllers/productController.js`)

**En `crearProducto()` y `editarProducto()`:**
- ✅ `nombre`: requerido (string)
- ✅ `precio`: requerido, número, **DEBE SER > 0**
- ✅ `stock` / `cantidadUnidades`: número, **DEBE SER >= 0**
- ✅ `imagenes`: array filtrado (elimina nulls)
- ✅ `imagenSrc`: string principal (si es diferente de imagenPrincipal)
- ✅ Conversión de tipos booleanos correcta (true/false, no strings)
- ✅ Manejo de errores descriptivos con `error.message`

**Ejemplo de validación en el controller:**
```javascript
if (!nombre || typeof nombre !== 'string') {
  return res.status(400).json({ error: 'Nombre es requerido' });
}
if (typeof precio !== 'number' || precio <= 0) {
  return res.status(400).json({ error: 'Precio debe ser > 0' });
}
if (typeof cantidadUnidades === 'number' && cantidadUnidades < 0) {
  return res.status(400).json({ error: 'Stock no puede ser negativo' });
}
// Filtrar nulls en imagenes
const imagenesFiltradas = imagenes ? imagenes.filter(img => img !== null) : [];
```

---

## Stack Tecnológico

- **Runtime:** Node.js
- **Framework:** Express.js
- **Base de Datos:** MongoDB + Mongoose
- **Almacenamiento:** Cloudinary
- **Autenticación:** JWT (jsonwebtoken)
- **Validación:** Joi
- **Seguridad:** helmet, xss-clean, express-rate-limit
- **Upload:** multer + multer-storage-cloudinary

---

## Notas Importantes

✅ **Estructura mejorada en `adminProductosRoutes.js`:**
- Validación de existencia de imágenes (POST)
- Validación de existencia de producto (PUT/DELETE)
- Estandarización de respuestas JSON
- Logging de operaciones
- Manejo centralizado de errores (usa `next(error)`)

---

**Última actualización:** 14 de noviembre de 2025
