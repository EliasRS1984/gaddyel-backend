# 📋 E-Commerce Platform - Audit & Enhancement Plan

**Date:** Nov 30, 2025 | **Status:** MVP ✅ → Production Enhancement 🚀

---

## ✅ VALIDATION CHECKLIST

### Backend Architecture ✅ COMPLETE

#### Models (Mongoose) ✅
- [x] Client.js
  - [x] name, email, whatsapp
  - [x] historialPedidos (references)
  - [x] totalGastado, totalPedidos (statistics)
  - [x] notasInternas
  - [x] Timestamps
  - ⚠️ **IMPROVEMENT NEEDED:** Address field for shipping (dirección completa)

- [x] Order.js
  - [x] clienteId (reference)
  - [x] items array with {productoId, cantidad, precioUnitario}
  - [x] total calculation
  - [x] estadoPago (pending, approved, rejected, cancelled)
  - [x] estadoPedido (pending, en_produccion, listo, enviado, entregado, cancelado)
  - [x] mercadoPagoId (preference)
  - [x] mercadoPagoPaymentId (actual payment)
  - [x] Timestamps & historialEstados
  - ⚠️ **IMPROVEMENT NEEDED:** orderNumber (incremental), paymentMethod, paymentDetails, checkoutUrl

- [x] WebhookLog.js
  - [x] type, externalId
  - [x] payload, procesado, resultado
  - [x] intentos (for retry logic)
  - [x] Timestamps
  - ✅ Good

#### Controllers ✅ COMPLETE

- [x] orderController.js
  - [x] createOrder (validation, stock check, client creation)
  - [x] getOrders (filtering, pagination)
  - [x] getOrderById
  - [x] updateOrderStatus
  - [x] getClientOrders
  - ⚠️ **IMPROVEMENT NEEDED:** Error handling for stock validation, decimal precision on prices

- [x] clientController.js
  - [x] getClients (search/filter)
  - [x] getClientById
  - [x] updateClient
  - [x] deleteClient (soft delete)
  - [x] getClientHistory
  - [x] getClientStats
  - ✅ Comprehensive

- [x] mercadoPagoController.js
  - [x] createCheckoutPreference
  - [x] handleWebhook
  - [x] procesarPago
  - ⚠️ **IMPROVEMENT NEEDED:** Webhook signature verification, payment status mapping, duplicate payment handling

#### Validators (Joi) ✅ COMPLETE

- [x] orderValidator.js
  - [x] createOrderSchema (items, cliente)
  - [x] updateOrderStatusSchema
  - [x] filterOrdersSchema
  - ⚠️ **IMPROVEMENT NEEDED:** Address validation, CUIT/DNI optional validation

- [x] clientValidator.js
  - [x] clientSchema (name, email, whatsapp, notes)
  - [x] filterClientsSchema
  - ⚠️ **IMPROVEMENT NEEDED:** Address full validation, phone format validation

#### Routes ✅ COMPLETE

- [x] orderRoutes.js (5 endpoints)
- [x] mercadoPagoRoutes.js (3 endpoints)
- [x] clientRoutes.js (6 endpoints)
- ✅ All registered in index.js

#### Middleware ⚠️ PARTIAL

- [x] authMiddleware.js (JWT verification)
- [x] errorHandler (global error handling)
- ⚠️ **MISSING:** Rate limiting on sensitive endpoints (/crear, /webhook)
- ⚠️ **MISSING:** Webhook signature verification middleware
- ⚠️ **MISSING:** Request logging/audit middleware

---

### Frontend Architecture ✅ COMPLETE

#### State Management ✅
- [x] CartContext with localStorage
- [x] useCart hook
- [x] Full CRUD operations
- ✅ Professional implementation

#### Pages ✅
- [x] Checkout.jsx (form, validation, API call)
- [x] PedidoConfirmado.jsx (success page)
- [x] PedidoPendiente.jsx (pending page)
- [x] PedidoFallido.jsx (failure page)
- ⚠️ **TODO:** HistorialPedidos.jsx (public order search)

#### Components ✅
- [x] Cart.jsx (cart review)
- [x] CartIcon.jsx (header badge)
- [x] DetalleProducto.jsx (add to cart integration)
- ⚠️ **IMPROVEMENT:** Add quantity selector to cart items

#### Integration ✅
- [x] App.jsx with CartProvider
- [x] All routes mounted
- [x] API_BASE from env vars
- ✅ Clean architecture

---

## 🚨 CRITICAL IMPROVEMENTS REQUIRED

### 1. **Webhook Security** 🔐 CRITICAL

**Current Status:** ❌ NOT IMPLEMENTED

**What's Missing:**
```javascript
// X-Signature verification from Mercado Pago
// Currently NOT checking webhook authenticity
```

**Implementation Required:**
```javascript
// src/middleware/webhookVerification.js
import crypto from 'crypto';

export const verifyMercadoPagoSignature = (req, res, next) => {
    const signature = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    
    if (!signature || !requestId) {
        return res.status(401).json({ error: 'Missing signature' });
    }

    // Verify using MP_SECRET
    const payload = JSON.stringify(req.body);
    const hash = crypto
        .createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET)
        .update(`${requestId}${payload}`)
        .digest('hex');

    if (hash !== signature) {
        console.warn('❌ Invalid MP signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
};
```

**Action:** Add to mercadoPagoRoutes.js before webhook handler

---

### 2. **Duplicate Payment Handling** ⚠️ HIGH PRIORITY

**Current Status:** ⚠️ PARTIAL

**Risk:** Same payment processed twice = double charging

**Implementation Required:**
```javascript
// In mercadoPagoController.js procesarPago()
const existingWebhook = await WebhookLog.findOne({
    externalId: paymentId,
    procesadoCorrectamente: true
});

if (existingWebhook) {
    console.log(`⚠️  Webhook duplicado detectado: ${paymentId}`);
    return res.json({ ok: true, duplicate: true });
}
```

**Action:** Add idempotency check in webhook handler

---

### 3. **Order Number Generation** ⚠️ HIGH PRIORITY

**Current Status:** ❌ MISSING

**What's Missing:**
- No incremental order numbers
- No human-readable order IDs

**Implementation Required:**
```javascript
// In orderController.js createOrder()
const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
const orderNumber = (lastOrder?.orderNumber || 0) + 1;

const newOrder = new Order({
    ...ordenData,
    orderNumber: String(orderNumber).padStart(6, '0') // #000001
});
```

**Action:** Update Order model & createOrder controller

---

### 4. **Address Management** ⚠️ MEDIUM PRIORITY

**Current Status:** ⚠️ MISSING

**What's Missing:**
- No shipping address in Order
- No address history in Client

**Implementation Required:**
```javascript
// Update Cliente model
const clientSchema = new mongoose.Schema({
    // ... existing fields
    direccion: {
        calle: String,
        numero: String,
        piso: String,
        ciudad: String,
        codigoPostal: String,
        provincia: String,
        completa: String // Full address string
    },
    direccionesAlternativas: [{
        alias: String, // "Casa", "Oficina", etc
        calle: String,
        numero: String,
        // ...
    }]
});

// Update Order model
const orderSchema = new mongoose.Schema({
    // ... existing fields
    direccionEntrega: {
        calle: String,
        numero: String,
        piso: String,
        ciudad: String,
        codigoPostal: String,
        provincia: String,
        completa: String
    }
});
```

**Action:** Update models & validators & checkout form

---

### 5. **Payment Method Tracking** ⚠️ MEDIUM PRIORITY

**Current Status:** ⚠️ PARTIAL

**Enhancement Needed:**
```javascript
// Update Order model to track payment method details
const orderSchema = new mongoose.Schema({
    // ... existing
    paymentMethod: {
        type: String, // 'credit_card', 'debit_card', 'transfer', 'wallet'
        enum: ['credit_card', 'debit_card', 'transfer', 'wallet', 'unknown']
    },
    paymentDetails: {
        cardLastFour: String,
        cardBrand: String,
        installments: Number,
        issuerBank: String,
        authorizationCode: String
    }
});
```

**Action:** Extend mercadoPagoController to extract & store payment details

---

### 6. **Stock Validation** ⚠️ CRITICAL

**Current Status:** ⚠️ INCOMPLETE

**What's Missing:**
```javascript
// Current: Checks if product exists
// Missing: Checks if enough stock available
```

**Implementation Required:**
```javascript
// In orderController.js createOrder()
for (const item of items) {
    const producto = await Producto.findById(item.productoId);
    
    if (!producto) {
        return res.status(404).json({ 
            error: `Producto ${item.productoId} no encontrado` 
        });
    }

    // ✅ ADD THIS: Stock validation
    if (producto.cantidadUnidades < item.cantidad) {
        return res.status(400).json({
            error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.cantidadUnidades}, solicitado: ${item.cantidad}`
        });
    }

    // ⚠️ TODO: Deduct stock after payment confirmed
}
```

**Action:** Complete stock validation & add stock deduction on payment approval

---

### 7. **Decimal Precision** ⚠️ HIGH PRIORITY

**Current Status:** ⚠️ PARTIAL

**Risk:** Price rounding errors in totals

**Action Required:**
```javascript
// Use Decimal128 or multiplied integers
// Option 1: Use decimal.js library
import Decimal from 'decimal.js';

const subtotal = new Decimal(item.precio).times(item.cantidad);
const total = subtotal.plus(shippingCost).toNumber();

// Option 2: Store as cents (integers)
price: {
    type: Number, // Store as cents: 1999 = $19.99
    get: (v) => (v / 100).toFixed(2),
    set: (v) => Math.round(v * 100)
}
```

**Action:** Update models to use Decimal128 or cents-based pricing

---

### 8. **Rate Limiting** 🔐 CRITICAL

**Current Status:** ⚠️ PARTIAL (only on login)

**Missing Rate Limits On:**
- `/api/pedidos/crear` - prevent spam orders
- `/api/mercadopago/webhook` - prevent DOS
- `/api/pedidos/cliente/:id` - prevent scraping

**Implementation Required:**
```javascript
// src/middleware/rateLimiters.js
import rateLimit from 'express-rate-limit';

export const createOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 orders per IP
    message: 'Too many orders created from this IP'
});

export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 webhooks per minute
    keyGenerator: (req) => req.headers['x-request-id'] // Use MP request ID
});

// Apply in routes:
router.post('/crear', createOrderLimiter, createOrder);
router.post('/webhook', webhookLimiter, verifySignature, handleWebhook);
```

**Action:** Add rate limiting middleware to sensitive routes

---

### 9. **Email Notifications** 📧 MEDIUM PRIORITY

**Current Status:** ❌ NOT IMPLEMENTED

**What's Needed:**
- Order confirmation email
- Payment success email
- Payment failure email
- Shipping update email

**Implementation Required:**
```javascript
// src/services/emailService.js
import nodemailer from 'nodemailer';

export const sendOrderConfirmationEmail = async (order, customer) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const html = `
        <h2>Pedido #${order.orderNumber} Confirmado</h2>
        <p>Hola ${customer.nombre},</p>
        <p>Gracias por tu compra. Tu pedido está siendo procesado.</p>
        <p><strong>Total:</strong> $${order.total}</p>
        <p><strong>Estado:</strong> ${order.estadoPago}</p>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Pedido #${order.orderNumber} - Confirmación`,
        html
    });
};

// Call after order creation:
// await sendOrderConfirmationEmail(newOrder, cliente);
```

**Action:** Implement email service (optional for MVP)

---

### 10. **Comprehensive Logging/Audit Trail** 🔍 MEDIUM PRIORITY

**Current Status:** ⚠️ PARTIAL

**Current:** Uses console.log  
**Needed:** Structured logging with levels

**Implementation Required:**
```javascript
// src/utils/logger.js
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

export const logAudit = (action, details, level = 'INFO') => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        action,
        details,
        nodeEnv: process.env.NODE_ENV
    };

    // Log to file (production)
    fs.appendFileSync(
        path.join(logDir, `audit-${new Date().toISOString().split('T')[0]}.log`),
        JSON.stringify(logEntry) + '\n'
    );

    // Log to console (development)
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${level}] ${action}:`, details);
    }
};

// Usage in controllers:
// logAudit('ORDER_CREATED', { orderId, total, clientEmail }, 'INFO');
// logAudit('PAYMENT_FAILED', { orderId, reason }, 'WARNING');
```

**Action:** Implement structured logging (optional for MVP)

---

## 📋 IMPLEMENTATION PRIORITY MATRIX

### 🔴 CRITICAL (Must implement before production)
1. Webhook signature verification
2. Stock validation & deduction
3. Duplicate payment handling
4. Decimal precision for prices
5. Rate limiting on sensitive endpoints

### 🟡 HIGH (Implement soon)
6. Order number generation
7. Address management in Order
8. Payment method tracking
9. Return payment status correctly

### 🟢 MEDIUM (Nice to have)
10. Email notifications
11. Comprehensive logging
12. PDF invoice generation
13. Refund/cancellation logic
14. Dashboard analytics

### 🔵 LOW (Future enhancements)
15. SMS notifications
16. Shipping integration API
17. Tax calculation
18. Multi-currency support
19. Gift cards/coupons

---

## 🧪 TESTING COVERAGE NEEDED

### Unit Tests
```javascript
// Test order total calculation with decimal precision
// Test webhook signature verification
// Test duplicate payment detection
// Test stock validation
// Test payment status mapping
```

### Integration Tests
```javascript
// End-to-end order creation flow
// Payment approval workflow
// Payment rejection workflow
// Webhook processing with retries
// Client CRM updates
```

### Security Tests
```javascript
// Webhook verification failures
// Invalid signature attempts
// Rate limiting effectiveness
// SQL/NoSQL injection attempts
// XSS in order data
```

---

## 📊 DEPLOYMENT CHECKLIST FOR PRODUCTION

### Backend (Render)
- [ ] Set all required env vars:
  - [ ] MONGODB_URI
  - [ ] JWT_ACCESS_SECRET
  - [ ] JWT_REFRESH_SECRET
  - [ ] MERCADO_PAGO_ACCESS_TOKEN
  - [ ] MERCADO_PAGO_WEBHOOK_SECRET
  - [ ] EMAIL_USER (optional)
  - [ ] EMAIL_PASSWORD (optional)
- [ ] Configure webhook URL in Mercado Pago dashboard
- [ ] Configure return URLs in Mercado Pago (success/failure)
- [ ] Test webhook with Mercado Pago sandbox
- [ ] Enable HTTPS (Render does this automatically)
- [ ] Set up error monitoring (Sentry, LogRocket, etc)
- [ ] Performance monitoring

### Frontend (Vercel)
- [ ] Set VITE_API_BASE env var
- [ ] Configure CORS on backend for production domain
- [ ] Test with real payment (small amount)
- [ ] Performance audit (Lighthouse)
- [ ] Mobile responsiveness check
- [ ] Browser compatibility test

### Database (MongoDB Atlas)
- [ ] Create production cluster
- [ ] Enable IP whitelisting (Render IPs)
- [ ] Enable backups
- [ ] Create read-only user for analytics
- [ ] Set up alerts for high CPU/memory

### Monitoring & Logging
- [ ] Set up error tracking
- [ ] Set up request logging
- [ ] Set up webhook monitoring
- [ ] Create alerts for payment failures
- [ ] Create alerts for high error rates

---

## 🎯 NEXT SESSION PRIORITIES

### Session Roadmap
1. **Implement Critical Fixes (2-3 hours)**
   - Webhook signature verification
   - Stock validation & deduction
   - Duplicate payment detection
   - Decimal precision

2. **Implement High Priority Features (2-3 hours)**
   - Order number generation
   - Address management
   - Payment method tracking
   - Rate limiting

3. **Testing & Validation (1-2 hours)**
   - Manual testing of complete flow
   - Edge case testing
   - Security testing
   - Load testing

4. **Documentation (1 hour)**
   - API endpoint documentation
   - Deployment guide
   - Webhook payload examples
   - Troubleshooting guide

---

## 📚 RECOMMENDATIONS

### Architecture
✅ **Good:** Separation of concerns, modular structure, clear naming  
⚠️ **Improve:** Add more middleware, add services layer for business logic

### Security
✅ **Good:** JWT auth, error messages don't leak data  
⚠️ **Missing:** Webhook verification, rate limiting on sensitive endpoints

### Data Integrity
✅ **Good:** Joi validation, Mongoose schemas  
⚠️ **Missing:** Stock deduction logic, decimal precision handling

### Scalability
✅ **Good:** Stateless API design, indexes on key fields  
⚠️ **Missing:** Caching strategy, batch processing for webhooks

### Maintainability
✅ **Good:** Clear folder structure, descriptive function names  
⚠️ **Missing:** JSDoc comments, comprehensive error handling

---

## ✨ SUMMARY

**Current System Status: MVP ✅**
- Core e-commerce flow: ✅ Working
- Cart system: ✅ Working
- Order creation: ✅ Working
- Basic payment handling: ✅ Working
- Client management: ✅ Working

**Ready for Production: ⚠️ With improvements**
- Need: Webhook security
- Need: Stock management
- Need: Payment method tracking
- Need: Comprehensive testing

**Timeline for Production:**
- Critical fixes: **1-2 days**
- High priority features: **2-3 days**
- Testing & fixes: **2-3 days**
- **Total: 1-2 weeks to production-ready**

---

**Next Action:** Implement critical fixes (task checklist above)  
**Target:** Production deployment by Dec 10, 2025

