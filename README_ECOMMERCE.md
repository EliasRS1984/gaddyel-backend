# 🛍️ Gaddyel E-Commerce Backend

Sistema backend profesional para plataforma de e-commerce con integración completa de **Mercado Pago**, gestión de órdenes, inventario y pagos.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Flujo de Compra](#flujo-de-compra)
- [Webhook de Mercado Pago](#webhook-de-mercado-pago)
- [Modelos de Datos](#modelos-de-datos)
- [Seguridad](#seguridad)
- [Deployment](#deployment)

---

## ✨ Características

### 🛒 Carrito y Checkout
- Validación de stock en tiempo real
- Creación de órdenes con snapshots de productos
- Soporte para variaciones (tallas, colores, materiales)
- Descuentos y envíos personalizados
- Direcciones múltiples por cliente

### 💳 Pagos Seguros
- Integración con **Mercado Pago Web Checkout**
- Validación de firmas HMAC en webhooks
- Reintentos de pago automáticos
- Manejo de pagos pendientes, aprobados y rechazados
- Reembolsos completos o parciales
- Auditoría completa de transacciones

### 📦 Gestión de Órdenes
- Estados de orden: pending_payment → paid → processing → shipped → delivered
- Historial de intentos de pago
- Notas de administrador
- Búsqueda y filtrado avanzado
- Dashboard de estadísticas

### 📊 Inventario
- Control de stock: total, available, reserved
- Bajo stock automático (threshold configurable)
- Reserva de stock en checkout
- Confirmación de venta en pago aprobado
- Liberación de stock en reembolsos

### 🔐 Seguridad
- Rate limiting por IP
- Validación de datos con Joi
- Sanitización de inputs
- CORS configurable
- Headers de seguridad (CSP, X-Frame-Options, etc.)
- Detección de anomalías
- Logs de auditoría

### 📧 Notificaciones
- Confirmación de órdenes
- Confirmación de pagos
- Notificaciones de rechazo
- Avisos de reembolsos
- Actualizaciones de envío

---

## 📦 Requisitos

- **Node.js** >= 14.0
- **MongoDB** >= 4.0 (Local o Atlas)
- **npm** o **yarn**
- Cuenta en **Mercado Pago** (desarrollador)
- **SMTP** para envío de correos (Gmail, SendGrid, etc.)

---

## 🚀 Instalación

### 1. Clonar Repositorio

```bash
git clone https://github.com/tu-usuario/gaddyel-backend.git
cd gaddyel-backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales.

### 4. Crear Índices de Base de Datos

```bash
npm run db:init
```

### 5. Iniciar el Servidor

**Desarrollo:**
```bash
npm run dev
```

**Producción:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Servidor
NODE_ENV=development
PORT=5000

# Base de Datos
MONGODB_URI=mongodb://localhost:27017/gaddyel-ecommerce

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx...
MERCADOPAGO_WEBHOOK_SECRET=tu_secret_key
MERCADOPAGO_SANDBOX=true

# URLs
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# Seguridad
JWT_SECRET=tu_secret_key_aqui
ALLOWED_ORIGINS=http://localhost:5173,https://gaddyel.com

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_de_app
EMAIL_FROM=noreply@gaddyel.com
```

---

## 📁 Estructura del Proyecto

```
src/
├── models/              # Esquemas de MongoDB
│   ├── Customer.js     # Clientes
│   ├── Order.js        # Órdenes de compra
│   └── Product.js      # Catálogo
├── controllers/         # Lógica de solicitudes HTTP
│   ├── ProductsController.js
│   ├── OrdersController.js
│   └── PaymentsController.js
├── services/           # Lógica de negocio
│   ├── mercadopagoService.js
│   ├── orderService.js
│   └── emailService.js
├── routes/             # Definición de endpoints
│   └── api.js
├── middlewares/        # Middlewares de Express
│   └── security.js
├── validations/        # Schemas de Joi
│   └── schemas.js
├── utils/              # Utilidades
│   └── logger.js
└── main.js             # Punto de entrada
```

---

## 📡 API Endpoints

### Productos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/products` | Listar productos con filtros |
| GET | `/api/products/featured` | Productos destacados |
| GET | `/api/products/new-arrivals` | Nuevos llegados |
| GET | `/api/products/search?q=...` | Buscar productos |
| GET | `/api/products/:slug` | Obtener por slug |
| GET | `/api/products/category/:category` | Por categoría |
| GET | `/api/products/availability/:id` | Verificar stock |
| GET | `/api/products/analytics/popular` | Más vendidos |

### Órdenes

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/orders` | Crear nueva orden |
| GET | `/api/orders` | Listar órdenes (admin) |
| GET | `/api/orders/:id` | Detalles de orden |
| GET | `/api/orders/number/:orderNumber` | Obtener por número |
| GET | `/api/customer/:customerId/orders` | Órdenes de cliente |
| PUT | `/api/orders/:id/status` | Actualizar estado (admin) |
| GET | `/api/orders/analytics/dashboard` | Dashboard (admin) |

### Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/checkout` | Iniciar checkout |
| GET | `/api/orders/:id/status` | Estado de pago |
| POST | `/api/orders/:id/retry` | Reintentar pago |
| POST | `/api/orders/:id/refund` | Solicitar reembolso |
| POST | `/api/webhooks/mercadopago` | Webhook (Mercado Pago) |

---

## 💰 Flujo de Compra

```
1. FRONTEND: Usuario agrega productos al carrito
   └─ Validar stock en tiempo real

2. FRONTEND: Usuario procede a checkout
   └─ Validar datos del cliente y dirección

3. BACKEND: POST /api/orders
   └─ Crear orden con status: pending_payment
   └─ Validar stock
   └─ Crear preferencia en Mercado Pago
   └─ Reservar stock
   └─ Enviar confirmación por email

4. RESPONSE: Retornar URL de checkout
   └─ checkoutUrl (producción)
   └─ sandboxCheckoutUrl (desarrollo)

5. FRONTEND: Redirigir a Mercado Pago
   └─ Usuario ingresa datos de pago

6. MERCADO PAGO: Procesar pago
   └─ Aprobado → webhook success
   └─ Rechazado → webhook failure
   └─ Pendiente → webhook pending

7. BACKEND: Webhook /api/webhooks/mercadopago
   └─ Validar firma HMAC
   └─ Actualizar estado de orden
   └─ Confirmar/liberar stock
   └─ Enviar notificación por email

8. FRONTEND: Redirección post-pago
   └─ Mostrar confirmación o error
```

---

## 🔔 Webhook de Mercado Pago

### Configurar URL en Mercado Pago

1. Ir a: https://www.mercadopago.com.ar/developers/es/reference
2. En "Webhooks", agregar:
   - URL: `https://tudominio.com/api/webhooks/mercadopago`
   - Eventos: `payment.created`, `payment.updated`

### Flujo de Webhook

```javascript
// REQUEST desde Mercado Pago
POST /api/webhooks/mercadopago
Content-Type: application/json
X-Signature: ts=1234567890,v1=hash...
X-Request-Id: 1234567890abc...

{
  "type": "payment",
  "data": {
    "id": 12345678901
  }
}

// Backend valida firma HMAC
const hash = HMAC-SHA256(
  `${xRequestId}:${bodyAsString}`,
  webhookSecret
);

// Si firma es válida, obtener detalles del pago
const payment = await MercadoPagoService.getPaymentDetails(paymentId);

// Actualizar orden según status
- approved → Order.status = 'paid', confirmar stock
- rejected → Order.status = 'failed', liberar stock
- pending → Order.status = 'pending_payment'
```

---

## 🗄️ Modelos de Datos

### Customer
```javascript
{
  name: String,
  email: String (unique),
  whatsapp: String,
  cuit: String,
  dni: String,
  addresses: [
    {
      street, city, province, zipCode,
      isDefault: Boolean
    }
  ],
  orderHistory: [ObjectId],
  statistics: {
    totalOrders: Number,
    totalSpent: Number,
    lastOrderDate: Date
  }
}
```

### Order
```javascript
{
  orderNumber: Number (unique, incremental),
  customer: ObjectId,
  customerSnapshot: {
    name, email, whatsapp, address
  },
  items: [
    {
      product: ObjectId,
      productName: String,
      quantity: Number,
      price: Number,
      productSnapshot: { sku, price, discount },
      variations: { size, color, material }
    }
  ],
  subtotal: Number,
  shippingCost: Number,
  discount: Number,
  total: Number,
  status: enum [
    'pending_payment',  // Esperando pago
    'paid',             // Pago confirmado
    'processing',       // En preparación
    'shipped',          // Enviado
    'delivered',        // Entregado
    'cancelled',        // Cancelado
    'refunded',         // Reembolsado
    'failed'            // Error
  ],
  mercadopagoPreferenceId: String,
  checkoutUrl: String,
  paymentHistory: [
    {
      paymentId: String,
      status: enum ['approved', 'rejected', 'pending'],
      amount: Number,
      method: String,
      timestamp: Date,
      failureReason: String
    }
  ],
  refundHistory: [
    {
      refundId: String,
      amount: Number,
      reason: String,
      timestamp: Date
    }
  ],
  createdAt: Date,
  paidAt: Date
}
```

### Product
```javascript
{
  name: String,
  slug: String (unique),
  sku: String (unique),
  description: String,
  shortDescription: String,
  price: Number,
  discountPrice: Number,
  discountPercentage: Number,
  category: enum ['remeras', 'pantalones', 'chaquetas', 'accesorios', 'calzados', 'otro'],
  stock: {
    total: Number,
    available: Number,
    reserved: Number,
    lowStockThreshold: Number (default: 10)
  },
  images: {
    main: String,
    gallery: [String],
    thumbnail: String
  },
  variations: [
    { type: String, name: String, options: [String] }
  ],
  specifications: {
    material: String,
    color: String,
    size: String,
    weight: Number,
    dimensions: String
  },
  rating: {
    average: Number (0-5),
    count: Number
  },
  sales: {
    count: Number,
    lastSaleDate: Date,
    revenue: Number
  },
  isActive: Boolean (default: true),
  isFeatured: Boolean,
  isNewArrival: Boolean,
  metaTitle: String,
  metaDescription: String,
  keywords: [String]
}
```

---

## 🔐 Seguridad

### Rate Limiting

```javascript
// API General: 100 requests / 15 minutos
// Checkout: 5 requests / 15 minutos  
// Webhooks: 30 requests / 1 minuto
```

### Headers de Seguridad

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
```

### Validación de Webhook

```javascript
// Mercado Pago envía:
X-Signature: ts=1234567890,v1=hash_hmacsha256

// Backend verifica:
const data = `${xRequestId}:${bodyAsString}`;
const expectedHash = HMAC-SHA256(data, WEBHOOK_SECRET);
if (expectedHash !== receivedHash) {
  reject("Firma inválida");
}
```

### Validación de Datos

```javascript
// Joi schemas para todas las solicitudes
- createOrder: Valida cliente, items, dirección
- cartItems: Valida productos y cantidades
- customerData: Valida email, teléfono, CUIT
```

---

## 📦 Deployment

### Heroku

```bash
# 1. Crear aplicación
heroku create gaddyel-backend

# 2. Agregar variable de entorno
heroku config:set MONGODB_URI="..."
heroku config:set MERCADOPAGO_ACCESS_TOKEN="..."

# 3. Deploy
git push heroku main
```

### Vercel (Serverless)

```bash
# 1. Instalar vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Configurar variables de entorno en panel
```

### AWS/GCP/Azure

Ver documentación específica en: `docs/DEPLOYMENT.md`

---

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm test

# Con cobertura
npm run test:coverage

# Integration tests
npm run test:integration
```

---

## 📝 Logging y Auditoría

Los logs se guardan en `logs/`:

- `YYYY-MM-DD.log` - Log general
- `transactions.log` - Registros de transacciones
- `webhooks.log` - Eventos de webhooks
- `security.log` - Alertas de seguridad

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

MIT License - Ver archivo LICENSE

---

## 📞 Contacto

- **Soporte**: support@gaddyel.com
- **Issues**: https://github.com/gaddyel/backend/issues
- **Docs**: https://docs.gaddyel.com

---

**Última actualización:** 2024
**Versión:** 1.0.0
