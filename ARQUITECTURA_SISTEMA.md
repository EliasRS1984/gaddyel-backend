# 🏗️ Arquitectura del Sistema - Gaddyel E-Commerce

## Diagrama de Flujo General

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - Carrito de compras                                     │   │
│  │ - Validación de productos                                │   │
│  │ - Checkout                                               │   │
│  │ - Redirección a Mercado Pago                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ API Calls (HTTPS)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    BACKEND (Node.js/Express)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ROUTES (/api)                         │   │
│  │  /products, /orders, /checkout, /webhooks               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                  MIDDLEWARES                             │   │
│  │  - Auth, Validation, Rate Limiting, Error Handler       │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │               CONTROLLERS (3)                            │   │
│  │  ┌─────────────────┐ ┌──────────────────┐               │   │
│  │  │ Products        │ │ Orders           │               │   │
│  │  │ - Listar        │ │ - Crear          │               │   │
│  │  │ - Filtrar       │ │ - Listar         │               │   │
│  │  │ - Buscar        │ │ - Obtener estado │               │   │
│  │  │ - Disponibilidad│ │ - Analytics      │               │   │
│  │  └─────────────────┘ └──────────────────┘               │   │
│  │  ┌──────────────────────────┐                            │   │
│  │  │ Payments                 │                            │   │
│  │  │ - Checkout               │                            │   │
│  │  │ - Webhook                │                            │   │
│  │  │ - Retry/Refund           │                            │   │
│  │  └──────────────────────────┘                            │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              SERVICES (Lógica)                           │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ OrderService                                      │  │   │
│  │  │ - Crear órdenes                                   │  │   │
│  │  │ - Procesar pagos                                  │  │   │
│  │  │ - Manejar stock                                   │  │   │
│  │  │ - Reintentos                                      │  │   │
│  │  │ - Reembolsos                                      │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ MercadoPagoService                                │  │   │
│  │  │ - Crear preferencias                              │  │   │
│  │  │ - Validar webhooks (HMAC)                         │  │   │
│  │  │ - Obtener detalles pago                           │  │   │
│  │  │ - Procesar notificaciones                         │  │   │
│  │  │ - Refundar                                        │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ EmailService                                      │  │   │
│  │  │ - Confirmaciones                                  │  │   │
│  │  │ - Notificaciones                                  │  │   │
│  │  │ - Plantillas HTML                                 │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              MODELS (MongoDB)                           │   │
│  │  ┌─────────┐ ┌────────────┐ ┌──────────┐               │   │
│  │  │Customer │ │Order       │ │Product   │               │   │
│  │  │- Info   │ │- Items     │ │- Stock   │               │   │
│  │  │- Addr   │ │- Pagos     │ │- Precios │               │   │
│  │  │- Órdenes│ │- Estado    │ │- Ratings │               │   │
│  │  └─────────┘ │- Snapshot  │ │- Ventas  │               │   │
│  │              └────────────┘ └──────────┘               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐
│   MongoDB        │ │ Mercado Pago API │ │ SMTP Server │
│                  │ │                  │ │             │
│ - Customers      │ │ - Preferences    │ │ - Email     │
│ - Orders         │ │ - Payments       │ │ - Notif     │
│ - Products       │ │ - Refunds        │ │             │
│ - Logs           │ │ - Webhooks       │ │             │
└──────────────────┘ └──────────────────┘ └─────────────┘
```

---

## Flujo de Compra Detallado

```
1. USUARIO EXPLORA
   ├─ GET /api/products ────► ProductsController.listProducts()
   │                         └─ Product.find() ────► MongoDB
   │
   └─ GET /api/products/:slug ──► ProductsController.getProductBySlug()
                                 └─ Product.findOne() ────► MongoDB

2. USUARIO AGREGA AL CARRITO (LOCAL - sin API)
   ├─ localStorage.setItem('cart', [products])
   └─ GET /api/products/availability/:id ──► Verificar stock

3. USUARIO PROCEDE A CHECKOUT
   ├─ POST /api/orders
   │  ├─ validate() - Joi schema
   │  ├─ OrdersController.createOrder()
   │  │  └─ OrderService.createOrder()
   │  │     ├─ Customer.findOrCreateByEmail()
   │  │     ├─ Order.create() ──► MongoDB
   │  │     ├─ Product.reserveStock() ──► MongoDB
   │  │     └─ MercadoPagoService.createPreference()
   │  │        └─ POST /v1/checkout/preferences ──► Mercado Pago API
   │  │           └─ Response: { preferenceId, checkoutUrl }
   │  └─ Response: { order, checkout }
   │
   └─ EmailService.sendOrderConfirmation() ──► SMTP

4. USUARIO PAGA EN MERCADO PAGO
   ├─ Frontend: Redirige a checkoutUrl
   ├─ Usuario ingresa datos de tarjeta
   ├─ Mercado Pago procesa pago
   │  ├─ approved ✅
   │  ├─ rejected ❌
   │  └─ pending ⏳
   │
   └─ Mercado Pago envía webhook

5. WEBHOOK PROCESAMIENTO
   ├─ POST /api/webhooks/mercadopago
   │  ├─ Validar Headers:
   │  │  ├─ X-Signature (HMAC-SHA256)
   │  │  └─ X-Request-Id
   │  │
   │  ├─ MercadoPagoService.validateWebhookSignature()
   │  │  └─ HMAC-SHA256 validation
   │  │
   │  ├─ MercadoPagoService.getPaymentDetails()
   │  │  └─ GET /v1/payments/{paymentId} ──► Mercado Pago API
   │  │
   │  ├─ Encontrar Order por preferenceId o external_reference
   │  │  └─ Order.findOne() ──► MongoDB
   │  │
   │  ├─ PaymentsController.processPaymentByStatus()
   │  │  ├─ Si approved:
   │  │  │  └─ OrderService.processPaymentSuccess()
   │  │  │     ├─ order.recordPaymentAttempt()
   │  │  │     ├─ Order.status = 'paid'
   │  │  │     ├─ Product.confirmSale() ──► MongoDB (actualizar stock)
   │  │  │     └─ EmailService.sendPaymentConfirmation()
   │  │  │
   │  │  ├─ Si rejected:
   │  │  │  └─ OrderService.processPaymentRejected()
   │  │  │     ├─ order.markPaymentFailed()
   │  │  │     ├─ Order.status = 'failed'
   │  │  │     ├─ Product.releaseStock() ──► MongoDB
   │  │  │     └─ EmailService.sendPaymentRejected()
   │  │  │
   │  │  └─ Si pending:
   │  │     └─ OrderService.processPaymentPending()
   │  │        ├─ order.recordPaymentAttempt()
   │  │        └─ Order.status = 'pending_payment'
   │  │
   │  └─ Response 200 OK

6. REINTENTOS (Si pago falla)
   ├─ Frontend: Mostrar botón "Reintentar pago"
   ├─ POST /api/orders/:orderId/retry
   │  └─ OrderService.retryPayment()
   │     ├─ Order.status = 'pending_payment'
   │     └─ MercadoPagoService.createPreference()
   │        └─ Nueva preferencia
   │
   └─ Vuelve a step 4

7. REEMBOLSOS (Post-pago)
   ├─ POST /api/orders/:orderId/refund
   │  └─ OrderService.refundOrder()
   │     ├─ MercadoPagoService.refundPayment()
   │     │  └─ POST /v1/payments/{paymentId}/refunds ──► MP API
   │     ├─ Order.refund() ──► MongoDB
   │     ├─ Product.releaseStock() ──► MongoDB
   │     └─ EmailService.sendRefundNotification()
   │
   └─ Usuario recibe dinero en 3-5 días

8. ACTUALIZACIÓN DE ENVÍO (Admin)
   ├─ PUT /api/orders/:orderId/status
   │  └─ OrdersController.updateOrderStatus()
   │     ├─ Order.status = 'processing' | 'shipped' | 'delivered'
   │     └─ EmailService.sendShipmentNotification()
   │
   └─ Cliente notificado por email
```

---

## Arquitectura de Carpetas

```
gaddyel-backend/
│
├── src/
│   ├── models/
│   │   ├── Customer.js        (300+ líneas)
│   │   ├── Order.js           (365+ líneas)
│   │   └── Product.js         (240+ líneas)
│   │
│   ├── controllers/
│   │   ├── ProductsController.js   (300 líneas)
│   │   ├── OrdersController.js     (400 líneas)
│   │   └── PaymentsController.js   (300 líneas)
│   │
│   ├── services/
│   │   ├── mercadopagoService.js   (341 líneas)
│   │   ├── orderService.js         (400 líneas)
│   │   └── emailService.js         (380 líneas)
│   │
│   ├── routes/
│   │   └── api.js             (150 líneas)
│   │
│   ├── middlewares/
│   │   └── security.js        (300 líneas)
│   │
│   ├── validations/
│   │   └── schemas.js         (250 líneas)
│   │
│   ├── utils/
│   │   └── logger.js          (200+ líneas existente)
│   │
│   └── main.js                (Punto de entrada)
│
├── logs/
│   ├── YYYY-MM-DD.log         (Log general)
│   ├── transactions.log       (Transacciones)
│   ├── webhooks.log           (Webhooks)
│   └── security.log           (Alertas)
│
├── .env.example               (100 líneas)
├── .env                       (Tu configuración)
├── package.json               (Dependencies)
├── README_ECOMMERCE.md        (700 líneas)
├── WEBHOOK_GUIDE.md           (500 líneas)
└── IMPLEMENTACION_RESUMEN.md  (Este archivo)
```

---

## Flujo de Datos de una Orden

```
CREATE ORDER:

Frontend                Backend                MongoDB
   │                      │                       │
   ├─ POST /orders ──────►│                       │
   │                      ├─ Validar datos        │
   │                      ├─ Crear Order ────────►│
   │                      │                       ├─ save()
   │                      │                       │
   │                      ├─ Reservar stock ─────►│
   │                      │                       ├─ update(stock.reserved)
   │                      │                       │
   │                      ├─ Crear preferencia MP │
   │                      │   en Mercado Pago     │
   │                      │                       │
   │                      ├─ Actualizar Order ───►│
   │                      │   (preferenceId)      ├─ update()
   │                      │                       │
   │◄─ JSON response ─────┤                       │
   │  { orderId,          │                       │
   │    checkoutUrl }     │                       │
   │                      │                       │
   └─ Redirige a MP       │                       │


PAYMENT WEBHOOK:

Mercado Pago             Backend                MongoDB
     │                      │                       │
     ├─ POST webhook ──────►│                       │
     │                      ├─ Validar firma        │
     │                      │                       │
     │                      ├─ Obtener Order ──────►│
     │                      │   (find por prefs)    │
     │                      │◄───────────────────────
     │                      │
     │                      ├─ Procesar según status
     │                      │                       │
     │                      ├─ Si approved:         │
     │                      │   ├─ Actualizar ────►│
     │                      │   │   Order.status =  │
     │                      │   │   'paid'          │
     │                      │   │                   │
     │                      │   └─ Confirmar ──────►│
     │                      │       Product.sales   │
     │                      │                       │
     │◄─ 200 OK ───────────┤                       │
     │                      │                       │
     └─ Reintenta si falla  │                       │
```

---

## Validación de Webhook (Seguridad)

```
Mercado Pago enviá:

POST /api/webhooks/mercadopago
Headers:
  X-Signature: ts=1234567890,v1=abc123def456xyz789
  X-Request-Id: uuid-request-id
  Content-Type: application/json

Body:
  {
    "type": "payment",
    "data": { "id": 1234567890 }
  }


Backend Valida:

1. Extraer datos de header:
   X-Signature: ts=1234567890,v1=abc123def456xyz789
   X-Request-Id: uuid-request-id

2. Crear firma:
   data = `${X-Request-Id}:${body}`
   expectedHash = HMAC-SHA256(data, WEBHOOK_SECRET)

3. Comparar:
   If expectedHash === receivedHash ✅
   Else ❌ Rechazar


Ejemplo:

X-Request-Id: abc-123-def-456
Body: {"type":"payment","data":{"id":1234567890}}

data = "abc-123-def-456:{"type":"payment","data":{"id":1234567890}}"
expectedHash = HMAC-SHA256(data, "tu_webhook_secret")
             = "abc123def456xyz789"

Si X-Signature contiene v1=abc123def456xyz789 ✅ Válido
Si no ❌ Inválido
```

---

## Estados de Orden

```
pending_payment ──────► paid
     │                  │
     │ pago falla       │ procesando
     └──► failed        └──► processing
           ├─ Liberar              │
           │  stock       OK        ├─ Preparar
           │               │        │ orden
           │ Reintentar    └──► shipped
           │  disponible        │
           ├─ retryPayment()    │ Enviar
           │  ✅ (máx 3 veces)  │
           │                    └──► delivered
           │                         │
           │                    Email al
           │                    cliente ✅
           │
           └─ No hay más reintentos
              └─ Liberar stock
                 Notificar cliente
                 Email: pago rechazado


REEMBOLSO:

paid ──► refunded
  │
  ├─ Refund API MP
  ├─ Order.refund()
  ├─ Liberar stock
  └─ Email confirmación
     (3-5 días para acreditar)
```

---

## Flujo de Seguridad

```
REQUEST HTTP
     │
     ├─ HTTPS ✅
     │
     ▼
validateJSON()
├─ Validar sintaxis JSON
└─ Si inválido ❌ → 400 Bad Request

     ▼
generateRequestId()
├─ Crear UUID único
└─ Para trazabilidad

     ▼
securityHeaders()
├─ X-Frame-Options: DENY
├─ X-Content-Type-Options: nosniff
├─ X-XSS-Protection: 1; mode=block
└─ CSP: default-src 'self'

     ▼
sanitizeInputs()
├─ Remover scripts
├─ Remover javascript:
└─ Trim strings

     ▼
detectAnomalies()
├─ Detectar path traversal (../)
├─ Detectar SQL injection
├─ Detectar XSS (<iframe>)
└─ Si detectado → logSecurity() + 400

     ▼
Rate Limiting
├─ API: 100 req/15 min
├─ Checkout: 5 req/15 min
├─ Webhook: 30 req/1 min
└─ Si superado → 429 Too Many Requests

     ▼
Validación (Joi)
├─ Validar tipos de datos
├─ Validar formato (email, etc)
├─ Validar longitud
└─ Si inválido → 400 + detalles error

     ▼
Controller
├─ Procesar lógica
└─ Retornar respuesta

     ▼
errorHandler()
├─ Capturar errores no manejados
├─ Loguear
└─ Retornar respuesta 5xx
```

---

## Índices de Base de Datos

```
CUSTOMER:
├─ email: 1          (Único)
├─ cuit: 1           (Único)
├─ name: text        (Búsqueda)
└─ createdAt: -1     (Ordenamiento)

ORDER:
├─ (customer, createdAt)  (Compound)
├─ (status, createdAt)    (Compound)
├─ paymentId: 1           (Búsqueda)
├─ mercadopagoPreferenceId: 1
├─ orderNumber: 1         (Único)
└─ createdAt: -1

PRODUCT:
├─ (name, description): text
├─ (category, isActive): compound
├─ sku: 1                  (Único)
├─ (isFeatured, isActive): compound
├─ price: 1
└─ sales.count: -1         (Más vendidos)
```

---

**Diagrama actualizado:** 30 nov 2024
**Versión:** 1.0.0
