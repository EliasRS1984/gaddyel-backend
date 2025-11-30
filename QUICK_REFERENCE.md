# 📘 Quick Reference - Guía Rápida

Referencia rápida de comandos, endpoints y métodos más usados.

---

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env
cp .env.example .env
# Editar .env con credenciales

# 3. Iniciar servidor
npm run dev

# 4. Crear índices de BD
npm run db:init
```

---

## 📡 API Endpoints Principales

### GET Products

```bash
# Listar con filtros
GET /api/products?page=1&limit=20&category=remeras&minPrice=100

# Búsqueda
GET /api/products/search?q=remera

# Por slug
GET /api/products/remeraazul

# Disponibilidad
GET /api/products/availability/123456?quantity=2
```

### POST/GET Orders

```bash
# Crear orden
POST /api/orders
Body: {
  customerData: { name, email, whatsapp, cuit },
  items: [{ productId, quantity, price, variations }],
  shippingAddress: { street, city, province, zipCode },
  shippingCost: 0,
  discount: 0
}

# Listar órdenes
GET /api/orders?status=paid&page=1&limit=10

# Obtener detalles
GET /api/orders/{orderId}

# Estado de pago
GET /api/orders/{orderId}/status

# Reintentar pago
POST /api/orders/{orderId}/retry

# Refundar
POST /api/orders/{orderId}/refund
Body: { reason: "..." }
```

### Payment

```bash
# Iniciar checkout
POST /api/checkout
Body: { orderId: "123456" }

# Webhook (Mercado Pago)
POST /api/webhooks/mercadopago
Headers: {
  X-Signature: "ts=...,v1=...",
  X-Request-Id: "..."
}
```

---

## 📦 Variables de Entorno Esenciales

```env
# Base datos
MONGODB_URI=mongodb://localhost/gaddyel

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...

# URLs
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu@gmail.com
SMTP_PASS=...
```

---

## 🛒 Cart Context (React)

```javascript
import { useCartStore } from '@/store/cartStore';

const cart = useCartStore();

// Agregar item
cart.addItem(product, quantity, variations);

// Actualizar cantidad
cart.updateQuantity(productId, newQuantity);

// Remover
cart.removeItem(productId);

// Obtener total
const total = cart.getTotal();

// Obtener cantidad
const count = cart.getItemCount();
```

---

## 🔐 Validación de Webhook

```javascript
const crypto = require('crypto');

function validateSignature(headers, body) {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  
  const [, signature] = xSignature.split(',');
  const [, receivedHash] = signature.split('=');
  
  const data = `${xRequestId}:${body}`;
  const expectedHash = crypto
    .createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(data)
    .digest('hex');
  
  return expectedHash === receivedHash;
}
```

---

## 🗄️ Modelos de Datos (Mongoose)

### Customer

```javascript
{
  name: String,
  email: String (unique),
  whatsapp: String,
  cuit: String,
  addresses: [{
    street, city, province, zipCode,
    isDefault: Boolean
  }],
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
  orderNumber: Number (unique),
  customer: ObjectId,
  items: [{
    product: ObjectId,
    productName: String,
    quantity: Number,
    price: Number,
    variations: Object
  }],
  subtotal: Number,
  shippingCost: Number,
  discount: Number,
  total: Number,
  status: enum ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'failed'],
  mercadopagoPreferenceId: String,
  paymentHistory: [{
    paymentId: String,
    status: String,
    amount: Number,
    timestamp: Date
  }],
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
  price: Number,
  discountPrice: Number,
  category: enum ['remeras', 'pantalones', ...],
  stock: {
    total: Number,
    available: Number,
    reserved: Number,
    lowStockThreshold: Number
  },
  images: {
    main: String,
    gallery: [String]
  },
  isActive: Boolean,
  rating: { average: Number, count: Number },
  sales: { count: Number, revenue: Number }
}
```

---

## 🎯 Métodos de Servicio

### OrderService

```javascript
// Crear orden
await OrderService.createOrder({
  customerData,
  items,
  shippingAddress,
  shippingCost,
  discount
});

// Procesar pago aprobado
await OrderService.processPaymentSuccess(orderId, paymentData);

// Procesar pago rechazado
await OrderService.processPaymentRejected(orderId, paymentData);

// Reintentar pago
await OrderService.retryPayment(orderId);

// Refundar
await OrderService.refundOrder(orderId, reason);
```

### MercadoPagoService

```javascript
// Crear preferencia
await MercadoPagoService.createPreference(orderData);

// Validar firma
MercadoPagoService.validateWebhookSignature(headers, body);

// Obtener detalles pago
await MercadoPagoService.getPaymentDetails(paymentId);

// Refundar
await MercadoPagoService.refundPayment(paymentId, amount);
```

### EmailService

```javascript
// Confirmación de orden
await EmailService.sendOrderConfirmation(orderData);

// Confirmación de pago
await EmailService.sendPaymentConfirmation(paymentData);

// Pago rechazado
await EmailService.sendPaymentRejected(paymentData);

// Confirmación de reembolso
await EmailService.sendRefundNotification(refundData);
```

---

## 🛡️ Validaciones Joi

```javascript
const schema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  whatsapp: Joi.string().pattern(/^(\+?54)?[\d\s\-]{9,}$/).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
});

const { error, value } = schema.validate(data);
```

---

## 🔍 Debugging

### Logs

```bash
# Ver logs en tiempo real
tail -f logs/YYYY-MM-DD.log

# Ver transacciones
tail -f logs/transactions.log

# Ver webhooks
tail -f logs/webhooks.log

# Ver alertas de seguridad
tail -f logs/security.log
```

### MongoDB Queries

```javascript
// Contar órdenes
db.orders.countDocuments({ status: 'paid' });

// Ver órdenes recientes
db.orders.find().sort({ createdAt: -1 }).limit(10);

// Stock bajo
db.products.find({ $expr: { $lt: ['$stock.available', '$stock.lowStockThreshold'] } });
```

### Postman Testing

```
1. Crear colección "Gaddyel API"

2. GET /api/products
   - Probar paginación
   - Probar filtros

3. POST /api/orders
   - Usar ambiente variables
   - Validar response

4. POST /api/webhooks/mercadopago
   - Generar firma HMAC válida
   - Probar con datos reales
```

---

## 📊 Métricas Útiles

```bash
# Órdenes totales
db.orders.countDocuments();

# Órdenes pagas
db.orders.countDocuments({ status: 'paid' });

# Ingresos totales
db.orders.aggregate([
  { $match: { status: 'paid' } },
  { $group: { _id: null, total: { $sum: '$total' } } }
]);

# Producto más vendido
db.products.findOne({}, { sort: { 'sales.count': -1 } });

# Cliente más valioso
db.customers.findOne({}, { sort: { 'statistics.totalSpent': -1 } });
```

---

## 🚨 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| **Webhook no se recibe** | Verificar URL en Mercado Pago + ngrok |
| **Firma webhook inválida** | Usar body como STRING, no parseado |
| **Stock no se actualiza** | Verificar índices: `npm run db:init` |
| **Email no se envía** | Verificar SMTP_HOST, SMTP_USER, SMTP_PASS |
| **Orden duplicada** | Implementar idempotencyKey |
| **Producto no se encuentra** | Verificar que `isActive: true` |

---

## 💡 Tips & Tricks

```javascript
// 1. Usar idempotencyKey en creación de órdenes
const idempotencyKey = crypto.randomUUID();

// 2. Siempre validar stock antes de crear orden
const available = product.stock.available;
if (available < quantity) throw new Error('Stock insuficiente');

// 3. Usar snapshots para auditoría
order.customerSnapshot = { name, email, address };
order.items[i].productSnapshot = { sku, price };

// 4. Rate limiting en checkout
app.post('/api/checkout', strictLimiter, ...);

// 5. Implementar reintentos
if (order.paymentHistory.length < MAX_RETRIES) {
  // Permitir reintentar
}
```

---

## 📚 Documentación Completa

- **README_ECOMMERCE.md** - Guía principal
- **WEBHOOK_GUIDE.md** - Webhooks detallado
- **ARQUITECTURA_SISTEMA.md** - Diagramas y flujos
- **FRONTEND_INTEGRATION.md** - Integración con React
- **IMPLEMENTACION_RESUMEN.md** - Resumen ejecutivo

---

## 🔗 Enlaces Útiles

- [Mercado Pago Docs](https://www.mercadopago.com.ar/developers/es/reference)
- [MongoDB Docs](https://docs.mongodb.com)
- [Express Docs](https://expressjs.com)
- [Joi Validation](https://joi.dev)
- [Nodemailer Docs](https://nodemailer.com)

---

**Última actualización:** 30 nov 2024
**Versión:** 1.0.0
