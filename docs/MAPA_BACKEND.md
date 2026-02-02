# 🍳 MAPA BACKEND - Gaddyel (API RESTful)

> **Analogía:** Soy la cocina y bodega del restaurante donde se preparan pedidos y se guardan datos.

---

## 📍 ESTRUCTURA DEL PROYECTO

```
gaddyel-backend/
├── src/
│   ├── controllers/           → 👨‍🍳 Los chefs (reciben pedidos y responden)
│   │   ├── orderController.js → Chef de pedidos: "Recibe orden, calcula total"
│   │   ├── productController.js → Chef del menú: "Dame todos los platos"
│   │   ├── mercadoPagoController.js → Cajero: "Procesa el pago"
│   │   ├── adminAuthController.js → Portero del admin: "Verifica credenciales"
│   │   ├── clientController.js → Chef de clientes: "CRUD de clientes"
│   │   └── carouselController.js → Chef del carrusel: "Gestiona imágenes"
│   │
│   ├── models/                → 📦 Las cajas donde guardamos información
│   │   ├── Order.js           → Caja de "Pedidos" (MongoDB)
│   │   ├── Product.js         → Caja de "Productos del menú"
│   │   ├── Client.js          → Caja de "Clientes registrados"
│   │   ├── AdminUser.js       → Caja de "Usuarios admin"
│   │   ├── OrderEventLog.js   → Caja de "Logs de eventos de órdenes"
│   │   ├── WebhookLog.js      → Caja de "Logs de webhooks MP"
│   │   ├── PaymentConfig.js   → Caja de "Configuración de pagos"
│   │   └── SystemConfig.js    → Caja de "Configuración global"
│   │
│   ├── routes/                → 🚪 Las puertas de entrada a cocina
│   │   ├── orders.js          → Puerta: POST /pedidos/crear
│   │   ├── productos.js       → Puerta: GET /api/productos
│   │   ├── mercadopago.js     → Puerta: POST /mercadopago/create-preference
│   │   ├── webhooks.js        → Puerta: POST /webhooks/mercadopago
│   │   └── admin.js           → Puerta: Admin endpoints
│   │
│   ├── services/              → 🔌 Conexiones con otros negocios
│   │   └── MercadoPagoService.js → Cable a Mercado Pago (banco)
│   │
│   ├── middleware/            → 🛡️ Guardias de seguridad
│   │   ├── auth.js            → Revisa que tengas token válido
│   │   ├── errorHandler.js    → Atrapa errores antes de explotar
│   │   └── rateLimiter.js     → Limita requests por IP
│   │
│   ├── validators/            → ✅ Inspectores de calidad
│   │   └── noSqlInjectionValidator.js → "Este pedido es sospechoso?"
│   │
│   ├── config/                → ⚙️ Configuración de la cocina
│   │   ├── db.js              → Conexión a MongoDB (bodega principal)
│   │   └── cloudinary.js      → Conexión a fotos en la nube
│   │
│   ├── utils/                 → 🛠️ Herramientas útiles
│   │   ├── logger.js          → Sistema de logs (Winston)
│   │   └── helpers.js         → Funciones auxiliares
│   │
│   └── index.js               → 🚀 Punto de entrada (servidor Express)
│
├── Data/                      → 📊 Datos iniciales
│   └── productos.json         → Productos de ejemplo para seeding
│
└── .env                       → 🔐 Variables secretas (DB, MP keys, JWT)
```

---

## 📁 RESPONSABILIDAD DE ARCHIVOS

| Archivo | Misión en una frase |
|---------|---------------------|
| **orderController.js** | *"Soy el chef de pedidos; valido items, recalculo total y guardo en MongoDB"* |
| **productController.js** | *"Soy el chef del menú; devuelvo lista de productos con paginación"* |
| **mercadoPagoController.js** | *"Soy el cajero; creo preferencias de pago y proceso webhooks"* |
| **adminAuthController.js** | *"Soy el portero del admin; verifico usuario y password"* |
| **clientController.js** | *"Soy el gestor de clientes; CRUD de clientes registrados"* |
| **Order.js (Model)** | *"Soy la caja de pedidos; defino cómo se guarda: {cliente, items, total, status}"* |
| **Product.js (Model)** | *"Soy la caja de productos; defino: {nombre, precio, imagen, stock}"* |
| **Client.js (Model)** | *"Soy la caja de clientes; guardo: {nombre, email, whatsapp, domicilio}"* |
| **AdminUser.js (Model)** | *"Soy la caja de admins; guardo: {email, passwordHash, role}"* |
| **OrderEventLog.js (Model)** | *"Soy el historial de cambios de órdenes; auditoría completa"* |
| **WebhookLog.js (Model)** | *"Soy el registro de webhooks; guardo todas las notificaciones de MP"* |
| **MercadoPagoService.js** | *"Soy el cable a Mercado Pago; creo preferencias y verifico pagos"* |
| **auth.js (Middleware)** | *"Soy el guardia; reviso que el JWT sea válido antes de dejar pasar"* |
| **errorHandler.js (Middleware)** | *"Soy el bombero; atrapo errores y devuelvo responses uniformes"* |
| **noSqlInjectionValidator.js** | *"Soy el inspector; reviso que los IDs de MongoDB no sean ataques"* |
| **db.js (Config)** | *"Soy la llave a MongoDB; conecto a la bodega de datos"* |
| **cloudinary.js (Config)** | *"Soy la conexión a Cloudinary; subo/gestiono imágenes"* |

---

## 🔄 FLUJO DE CREACIÓN DE ORDEN (Backend)

### Paso a Paso Detallado

```
1. REQUEST LLEGA
   POST /pedidos/crear
   Body: {
     items: [{productoId: "67a...", cantidad: 2}],
     cliente: {nombre: "Juan", email: "juan@mail.com", ...}
   }
   Headers: {Authorization: "Bearer eyJ..."} (opcional)

2. MIDDLEWARE: Validación NoSQL Injection
   → noSqlInjectionValidator valida productoIds
   → Si contiene $ne, $gt, etc → 400 Bad Request
   → Si válido → Continúa

3. CONTROLLER: orderController.createOrder()
   a) Validar datos básicos:
      - items es array no vacío
      - cliente es objeto con nombre y email
      - email tiene formato válido: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
   
   b) Buscar productos en MongoDB:
      → Producto.find({_id: {$in: productoIds}})
      → Si algún producto no existe → 404
   
   c) Recalcular total en servidor:
      → Para cada item:
        - Obtener precio real de MongoDB
        - Calcular: precioReal * cantidad
      → totalNeto = sum(todos los subtotales)
   
   d) Aplicar comisión Mercado Pago:
      → Obtener tasa desde SystemConfig (default: 4.99%)
      → Fórmula: precioBruto = precioNeto / (1 - tasa)
      → Ejemplo: $8,000 / (1 - 0.0499) = $8,419.42
   
   e) Crear/Actualizar cliente:
      → Buscar cliente por email
      → Si existe → actualizar datos
      → Si no existe → crear nuevo Client
   
   f) Guardar orden en MongoDB:
      → new Order({
          cliente: clienteId,
          items: [{producto: prodId, cantidad, precio}],
          total: precioBruto,
          status: 'pendiente',
          metodoPago: 'mercado_pago'
        })
      → order.save()
   
   g) Registrar evento en log:
      → new OrderEventLog({
          orderId,
          event: 'created',
          description: 'Orden creada',
          performedBy: userId || 'system'
        })

4. RESPONSE AL FRONTEND
   → 201 Created
   → Body: {
       orderId: "67abc123...",
       total: 8419.42,
       status: "pendiente"
     }

5. ERROR HANDLING
   → Si cualquier paso falla → next(error)
   → errorHandler middleware:
     - Log del error (Winston)
     - Response uniforme: {error: "mensaje amigable"}
     - Status code apropiado (400, 404, 500)
```

---

## 💳 FLUJO DE MERCADO PAGO

### 1. Crear Preferencia de Pago

```javascript
// mercadoPagoController.js - createPreference()

1. Frontend envía: POST /mercadopago/create-preference
   Body: { orderId: "67abc..." }

2. Buscar orden en MongoDB:
   → Order.findById(orderId).populate('items.producto')
   → Si no existe → 404

3. Construir preferencia MP:
   → {
       items: [
         {
           title: producto.nombre,
           quantity: item.cantidad,
           unit_price: producto.precio,
           currency_id: "ARS"
         }
       ],
       back_urls: {
         success: "https://gaddyel.com/orden-confirmada?orderId=...",
         failure: "https://gaddyel.com/pago-fallido",
         pending: "https://gaddyel.com/pago-pendiente"
       },
       auto_return: "approved",
       external_reference: orderId,
       notification_url: "https://gaddyel-backend.onrender.com/webhooks/mercadopago"
     }

4. Llamar SDK de MP:
   → const preference = new Preference(client);
   → const result = await preference.create({ body: preferenceData });
   → Retorna: { init_point: "https://mpago.la/xyz123" }

5. Guardar preference_id en orden:
   → order.mercadopago.preferenceId = result.id
   → order.save()

6. Response al frontend:
   → 200 OK
   → Body: { checkoutUrl: result.init_point }
```

### 2. Webhook de Notificación

```javascript
// mercadoPagoController.js - handleWebhook()

1. MP envía: POST /webhooks/mercadopago
   Body: {
     action: "payment.created",
     data: { id: "987654321" },
     type: "payment"
   }
   Headers: {
     x-signature: "ts=123,v1=abc...",
     x-request-id: "uuid..."
   }

2. Validar firma HMAC:
   → Obtener webhook_secret de .env
   → Reconstruir firma: HMAC-SHA256(ts + data, secret)
   → Si no coincide → 401 Unauthorized (webhook falso)

3. Guardar webhook en log:
   → new WebhookLog({
       source: 'mercadopago',
       event: 'payment.created',
       payload: req.body,
       processedAt: new Date()
     })

4. Obtener detalles del pago:
   → GET https://api.mercadopago.com/v1/payments/{id}
   → Headers: {Authorization: "Bearer ACCESS_TOKEN"}
   → Response: {
       status: "approved",
       status_detail: "accredited",
       transaction_amount: 8419.42,
       external_reference: "67abc..." (orderId)
     }

5. Actualizar orden en MongoDB:
   → Order.findById(external_reference)
   → order.status = payment.status === 'approved' ? 'pagado' : 'rechazado'
   → order.mercadopago.paymentId = payment.id
   → order.mercadopago.paymentStatus = payment.status
   → order.save()

6. Registrar evento:
   → new OrderEventLog({
       orderId,
       event: payment.status === 'approved' ? 'payment_approved' : 'payment_rejected',
       description: `Pago ${payment.status}`,
       metadata: { paymentId: payment.id }
     })

7. Response a MP:
   → 200 OK (confirma recepción)
```

---

## 🔐 SEGURIDAD

### 1. Validación NoSQL Injection

```javascript
// validators/noSqlInjectionValidator.js

export const validateObjectId = (id, fieldName) => {
  // Detectar operadores MongoDB sospechosos
  const dangerousPatterns = /\$ne|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$regex/;
  
  if (typeof id !== 'string') {
    throw new Error(`${fieldName} debe ser string`);
  }
  
  if (dangerousPatterns.test(id)) {
    throw new Error(`${fieldName} contiene caracteres no permitidos`);
  }
  
  // Validar formato ObjectId (24 caracteres hex)
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new Error(`${fieldName} no es un ObjectId válido`);
  }
  
  return id;
};

// Uso en controller:
const productoId = validateObjectId(item.productoId, 'items[0].productoId');
```

### 2. Autenticación JWT

```javascript
// middleware/auth.js

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer abc..."
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // {id, email, role}
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Uso en rutas:
router.post('/pedidos/crear', verifyToken, orderController.createOrder);
```

### 3. Rate Limiting

```javascript
// middleware/rateLimiter.js

import rateLimit from 'express-rate-limit';

export const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                  // 10 requests por IP
  message: 'Demasiadas órdenes. Intenta en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false
});

// Uso:
router.post('/pedidos/crear', orderLimiter, orderController.createOrder);
```

---

## 📊 MODELOS DE DATOS (Mongoose)

### Order Schema

```javascript
const OrderSchema = new mongoose.Schema({
  // Cliente
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  
  // Items del pedido
  items: [{
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: 1
    },
    precioUnitario: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  
  // Totales
  total: {
    type: Number,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado'],
    default: 'pendiente'
  },
  
  // Mercado Pago
  mercadopago: {
    preferenceId: String,
    paymentId: String,
    paymentStatus: String
  },
  
  // Auditoría
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// Middleware pre-save: Actualizar updatedAt
OrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});
```

### Product Schema

```javascript
const ProductSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  imagen: {
    type: String,
    default: 'https://via.placeholder.com/300'
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  categoria: {
    type: String,
    enum: ['camisetas', 'toallas', 'gorras', 'otros']
  },
  visible: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsqueda
ProductSchema.index({ nombre: 'text', descripcion: 'text' });
ProductSchema.index({ categoria: 1, visible: 1 });
```

---

## 🧮 CÁLCULO DE PRECIOS (Bake-in Pricing)

### Fórmula de Comisión Mercado Pago

```javascript
// orderController.js

const calculateBakeInPrice = (precioNeto) => {
  // Obtener tasa de comisión desde SystemConfig
  const config = await SystemConfig.findOne();
  const tasa = config?.mercadoPago?.commissionRate || 0.0499; // 4.99% default
  
  // Fórmula: Precio Bruto = Precio Neto / (1 - Tasa)
  const precioBruto = precioNeto / (1 - tasa);
  
  // Redondear a 2 decimales
  return Math.round(precioBruto * 100) / 100;
};

// Ejemplo:
// Precio Neto: $8,000
// Tasa MP: 4.99%
// Precio Bruto: $8,000 / (1 - 0.0499) = $8,419.42
// Cliente paga: $8,419.42
// MP cobra 4.99%: $420.42
// Recibes: $7,999 ≈ $8,000 ✓
```

### Recalcular Total de Orden

```javascript
const recalcularTotal = async (items) => {
  let totalNeto = 0;
  
  // Calcular subtotal de cada item
  for (const item of items) {
    const producto = await Producto.findById(item.productoId);
    if (!producto) {
      throw new Error(`Producto ${item.productoId} no encontrado`);
    }
    
    const subtotal = producto.precio * item.cantidad;
    totalNeto += subtotal;
  }
  
  // Aplicar comisión MP (bake-in)
  const totalBruto = calculateBakeInPrice(totalNeto);
  
  return {
    totalNeto,
    totalBruto,
    comisionMP: totalBruto - totalNeto
  };
};
```

---

## 📡 ENDPOINTS PRINCIPALES

| Endpoint | Método | Controller | Descripción |
|----------|--------|------------|-------------|
| `/api/productos` | GET | `productController.getProducts` | Lista productos con paginación |
| `/api/productos/:id` | GET | `productController.getProductById` | Detalle de un producto |
| `/pedidos/crear` | POST | `orderController.createOrder` | Crear nueva orden |
| `/pedidos/:id` | GET | `orderController.getOrderById` | Detalle de orden |
| `/pedidos` | GET | `orderController.getAllOrders` | Listar todas las órdenes (admin) |
| `/mercadopago/create-preference` | POST | `mercadoPagoController.createPreference` | Generar link de pago MP |
| `/webhooks/mercadopago` | POST | `mercadoPagoController.handleWebhook` | Recibir notificaciones MP |
| `/auth/admin/login` | POST | `adminAuthController.login` | Login de administrador |
| `/clientes` | GET | `clientController.getAllClients` | Listar clientes (admin) |

---

## 🌐 VARIABLES DE ENTORNO (.env)

```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gaddyel?retryWrites=true&w=majority

# JWT
JWT_SECRET=tu_secreto_super_seguro_aqui
JWT_EXPIRES_IN=7d

# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-1234567890abcdef...
MP_WEBHOOK_SECRET=tu_webhook_secret_aqui

# Cloudinary
CLOUDINARY_CLOUD_NAME=gaddyel
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123def456...

# Server
PORT=5000
NODE_ENV=production

# CORS
FRONTEND_URL=https://gaddyel.com
ADMIN_URL=http://localhost:5173
```

---

## 🔍 LOGGING Y DEBUGGING

### Winston Logger

```javascript
// utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export default logger;

// Uso:
logger.info('Orden creada', { orderId: order._id, total: order.total });
logger.error('Error en webhook', { error: error.message, stack: error.stack });
```

### Logs de Consola

```javascript
// orderController.js
console.log('📨 POST /pedidos/crear - Orden recibida');
console.log('✅ Orden creada:', { orderId, total });
console.log('❌ Error validando items:', error.message);
```

---

## ✅ CHECKLIST DE CALIDAD

- [x] Validación estricta de inputs (NoSQL Injection)
- [x] JWT para autenticación
- [x] Rate limiting en endpoints críticos
- [x] Recálculo de precios en servidor (nunca confiar en frontend)
- [x] Logs de auditoría (OrderEventLog, WebhookLog)
- [x] Error handling global (errorHandler middleware)
- [x] Webhooks con validación de firma HMAC
- [x] Índices en MongoDB para queries frecuentes
- [x] Mongoose schemas con validaciones
- [x] CORS configurado correctamente

---

**Última actualización:** 25 de enero de 2026  
**Proyecto:** Gaddyel Backend (API RESTful)  
**Stack:** Node.js 22 + Express + MongoDB + Mercado Pago SDK v2
