# 📚 Guía de Uso - Nuevas Features (Phase 2)

---

## 1. 📦 Números de Orden Secuenciales

### Uso Automático en Controller

El `orderController.createOrder()` ahora genera automáticamente números de orden:

```javascript
// En frontend (Checkout.jsx)
POST /api/pedidos/crear
Body: {
  items: [...],
  cliente: { nombre, email, whatsapp }
}

// Respuesta:
{
  "ok": true,
  "ordenId": "507f1f77bcf86cd799439011",
  "orderNumber": "#000001",  // ← NUEVO
  "total": 1500,
  "mensaje": "Orden creada..."
}
```

### Acceso en Base de Datos

```javascript
// MongoDB
db.orders.findOne({ orderNumber: "#000001" })
```

### Función de Servicio Directa

```javascript
import { getNextOrderNumber } from '../services/orderNumberService.js';

// Generar próximo número
const orderNumber = await getNextOrderNumber(); // "#000001"

// Obtener actual sin incrementar
const current = await getCurrentOrderNumber(); // "#000000"

// Reiniciar (testing)
await resetOrderNumber();

// Establecer manualmente
await setOrderNumber(1000); // → "#001000"
```

---

## 2. 🔐 Verificación de Webhook

### Mercado Pago Webhook

Cuando Mercado Pago envía un webhook, **ahora es verificado automáticamente**:

```bash
# Mercado Pago envía:
POST /api/mercadopago/webhook
Headers:
  X-Signature: ts=1640000000,v1=base64_signature
  X-Request-Id: abc123def456
  X-Timestamp: 1640000000

Query:
  type=payment
  data[id]=12345678
```

**Sin firma válida:**
```json
{
  "error": "Invalid signature",
  "status": 401
}
```

**Con firma válida:**
```json
{
  "status": "received"
}
```

### Implementar en Cliente (Testing)

```javascript
// Para testing local, comentar verificación temporalmente
// import verifyMercadoPagoSignature from '../middleware/webhookVerification.js';
// router.post('/webhook', verifyMercadoPagoSignature, handleWebhook);

// O mockear signature:
const crypto = require('crypto');
const timestamp = Date.now().toString().split('.')[0];
const body = JSON.stringify({ data: { id: 123 } });
const hmac = crypto
  .createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET)
  .update(`${timestamp}.${body}`)
  .digest('base64');
  
// Header X-Signature: `ts=${timestamp},v1=${hmac}`
```

---

## 3. 📊 Auditoría - Logger de Operaciones

### Registro Automático de Operaciones

Las siguientes operaciones **se registran automáticamente**:

```javascript
// 1. Crear orden
// Log: ORDER_CREATED
{
  "timestamp": "2025-11-30T10:30:00Z",
  "operation": "ORDER_CREATED",
  "orderId": "507f1f77bcf86cd799439011",
  "orderNumber": "#000001",
  "metadata": {
    "clienteId": "507f1f77bcf86cd799439012",
    "total": 1500,
    "itemsCount": 2
  }
}

// 2. Stock insuficiente
// Log: ORDER_INSUFFICIENT_STOCK
{
  "operation": "ORDER_INSUFFICIENT_STOCK",
  "metadata": {
    "productoId": "507f1f77bcf86cd799439013",
    "productoNombre": "Producto XYZ",
    "required": 10,
    "available": 5
  }
}

// 3. Pago aprobado
// Log: PAYMENT_APPROVED
{
  "operation": "PAYMENT_APPROVED",
  "orderId": "507f1f77bcf86cd799439011",
  "metadata": {
    "orderNumber": "#000001",
    "paymentId": "mp-123456",
    "total": 1500,
    "clienteId": "507f1f77bcf86cd799439012"
  }
}

// 4. Pago rechazado
// Log: PAYMENT_REJECTED
{
  "operation": "PAYMENT_REJECTED",
  "orderId": "507f1f77bcf86cd799439011",
  "metadata": {
    "orderNumber": "#000001",
    "paymentId": "mp-123456",
    "statusDetail": "card_declined"
  }
}

// 5. Pago duplicado detectado
// Log: DUPLICATE_PAYMENT_DETECTED
{
  "operation": "DUPLICATE_PAYMENT_DETECTED",
  "orderId": "507f1f77bcf86cd799439011",
  "metadata": {
    "orderNumber": "#000001",
    "paymentId": "mp-123456",
    "previousPaymentId": "mp-654321"
  }
}
```

### Acceder a Logs

```javascript
import logger from '../utils/logger.js';

// Obtener todos los logs
const logs = await logger.getLogs();

// Obtener logs de un tipo específico
const paymentLogs = await logger.getLogs({ operation: 'PAYMENT_APPROVED' });

// Obtener logs de una orden
const orderLogs = await logger.getLogs({ orderId: '507f1f77bcf86cd799439011' });

// Obtener últimas 100 líneas
const recent = await logger.getLogs({ limit: 100 });
```

### Archivo de Logs

```bash
# Ubicación
logs/audit.log

# Contenido (JSON Lines)
{"timestamp":"2025-11-30T10:30:00Z","operation":"ORDER_CREATED",...}
{"timestamp":"2025-11-30T10:30:05Z","operation":"PAYMENT_APPROVED",...}
{"timestamp":"2025-11-30T10:30:10Z","operation":"DUPLICATE_PAYMENT_DETECTED",...}

# Leer últimas líneas
tail -n 50 logs/audit.log | jq

# Buscar órdenes fallidas
grep "ERROR\|REJECTED" logs/audit.log
```

---

## 4. ⚡ Rate Limiting

### Protección Automática

Los siguientes endpoints ahora tienen **rate limiting automático**:

#### 1. Crear Orden
```bash
POST /api/pedidos/crear
Límite: 10 órdenes por IP cada 15 minutos

# Error si se excede:
429 Too Many Requests
"Demasiadas órdenes desde esta dirección IP. Por favor intenta más tarde."

Response Headers:
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 1700000000
```

#### 2. Buscar Órdenes del Cliente
```bash
GET /api/pedidos/cliente/:clienteId
Límite: 30 búsquedas por IP cada 15 minutos

# Error si se excede:
429 Too Many Requests
"Demasiadas búsquedas. Por favor intenta más tarde."
```

#### 3. Webhooks de Mercado Pago
```bash
POST /api/mercadopago/webhook
Límite: 100 webhooks por minuto

# Importante: No afecta la verificación
# Los webhooks con X-Request-Id usan ese como key
```

### Para Usuarios Autenticados

```javascript
// Si req.user?.id existe:
// - Usa su ID como key en lugar de IP
// - Permite más requests (rate limit no se aplica igual)
// - Mejor para testing local

// En desarrollo, autenticarte permite más requests
```

### Testing de Rate Limit

```bash
# Simular 11 órdenes en corto tiempo
for i in {1..11}; do
  curl -X POST http://localhost:5000/api/pedidos/crear \
    -H "Content-Type: application/json" \
    -d '{"items":[...],"cliente":{...}}'
done

# El 11vo falla con 429
```

---

## 5. 📈 Detalles de Pago Capturados

### Antes
```javascript
// POST /api/mercadopago/payment/:ordenId
{
  "ok": true,
  "estadoPago": "approved",
  "estadoPedido": "en_produccion",
  "total": 1500,
  "fechaPago": "2025-11-30T10:30:00Z"
}
```

### Después
```javascript
{
  "ok": true,
  "orderNumber": "#000001",           // ← NUEVO
  "estadoPago": "approved",
  "estadoPedido": "en_produccion",
  "mercadoPagoId": "mp-preference-123",
  "total": 1500,
  "fechaPago": "2025-11-30T10:30:00Z",
  "detallesPago": {                   // ← NUEVO
    "cardLastFour": "4111",           // Últimos 4 dígitos
    "cardBrand": "Visa",              // Marca de tarjeta
    "installments": 3,                // Cuotas
    "paymentType": "card"             // Tipo de pago
  }
}
```

### Acceso en Base de Datos

```javascript
db.orders.findOne({ orderNumber: "#000001" }).detallesPago
// {
//   "cardLastFour": "4111",
//   "cardBrand": "Visa",
//   "installments": 3,
//   "paymentType": "card"
// }
```

---

## 6. 🏆 Detección de Pagos Duplicados

### Cómo Funciona

```javascript
// Si Mercado Pago envía el mismo pago 2 veces:

// Primera vez:
{
  "operation": "PAYMENT_APPROVED",
  "orderId": "#000001",
  "paymentId": "mp-12345"
}

// Segunda vez (webhook duplicado):
// - Sistema detecta el paymentId ya procesado
// - No cambia estado de la orden
// - Responde con 200 OK (idempotente)
// - Log: DUPLICATE_PAYMENT_DETECTED
```

### Verificar en Logs

```bash
grep "DUPLICATE_PAYMENT_DETECTED" logs/audit.log
# {"operation":"DUPLICATE_PAYMENT_DETECTED",...}
```

---

## 7. 🗂️ Estructura Mejorada de Orden

### Schema Completo

```javascript
// GET /api/pedidos/admin
{
  "_id": "507f1f77bcf86cd799439011",
  "orderNumber": "#000001",           // ← NUEVO
  "clienteId": "507f1f77bcf86cd799439012",
  
  // Items
  "items": [
    {
      "productoId": "507f1f77bcf86cd799439013",
      "nombre": "Producto A",
      "cantidad": 2,
      "precioUnitario": 500,
      "subtotal": 1000
    }
  ],
  
  // Costos desglosados
  "subtotal": 1000,                   // ← NUEVO
  "costoEnvio": 100,                  // ← NUEVO
  "impuestos": 180,                   // ← NUEVO
  "total": 1280,
  
  // Estados
  "estadoPago": "approved",           // pending|approved|rejected|cancelled|expired|refunded
  "estadoPedido": "en_produccion",    // pendiente|en_produccion|listo|enviado|entregado|cancelado
  
  // Mercado Pago
  "mercadoPagoId": "mp-pref-123",
  "mercadoPagoPaymentId": "mp-pay-456",
  "mercadoPagoCheckoutUrl": "https://mercadopago.com/...",
  
  // Pagos
  "metododePago": "credit_card",      // ← NUEVO
  "detallesPago": {                   // ← NUEVO
    "cardLastFour": "4111",
    "cardBrand": "Visa",
    "installments": 3,
    "issuerBank": "Banco X",
    "authorizationCode": "123456",
    "paymentType": "card"
  },
  "motivoRechazo": null,              // ← NUEVO
  
  // Direcciones
  "direccionEntrega": {               // ← NUEVO
    "calle": "Av. Corrientes",
    "numero": "1000",
    "piso": "5",
    "ciudad": "Buenos Aires",
    "codigoPostal": "1043",
    "provincia": "CABA"
  },
  
  // Fechas
  "fechaCreacion": "2025-11-30T10:30:00Z",
  "fechaPago": "2025-11-30T10:32:00Z",
  "fechaProduccion": null,
  "fechaEntregaEstimada": "2025-12-05T00:00:00Z",
  "fechaEntregaReal": null,
  
  // Datos comprador
  "datosComprador": {                 // ← Guardados con la orden
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "whatsapp": "5491123456789",
    "telefono": null,
    "cuit": null
  },
  
  // Auditoría
  "historialEstados": [
    {
      "estado": "pendiente",
      "fecha": "2025-11-30T10:30:00Z",
      "nota": "Orden creada",
      "modifiedBy": "system"            // ← NUEVO
    },
    {
      "estado": "en_produccion",
      "fecha": "2025-11-30T10:32:00Z",
      "nota": "Pago aprobado",
      "modifiedBy": "webhook"           // ← NUEVO
    }
  ],
  
  // Reintentos
  "intentosPago": [                   // ← NUEVO
    {
      "preferenceId": "mp-pref-123",
      "paymentId": "mp-pay-failed-1",
      "estado": "rejected",
      "resultado": "card_declined",
      "fechaIntento": "2025-11-30T10:31:00Z"
    }
  ],
  
  // Banderas
  "confirmacionEnviada": false,       // ← NUEVO
  "notasInternas": "",
  "notasCliente": "",
  
  // Timestamps
  "createdAt": "2025-11-30T10:30:00Z",
  "updatedAt": "2025-11-30T10:32:00Z"
}
```

---

## 8. 🧪 Ejemplos de Testing

### Test 1: Crear Orden y Verificar OrderNumber

```javascript
// Test
const response = await fetch('http://localhost:5000/api/pedidos/crear', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productoId: '...', cantidad: 1 }],
    cliente: { nombre: 'Test', email: 'test@test.com', whatsapp: '555' }
  })
});

const data = await response.json();
console.log(data.orderNumber); // "#000001" ← NUEVO

// Verificar en DB
db.orders.findOne({}, { orderNumber: 1 }).orderNumber // "#000001"
```

### Test 2: Verificar Logs

```bash
# Esperar 2 segundos y revisar logs
tail -f logs/audit.log

# Debe mostrar:
# {"operation":"ORDER_CREATED",...}
# {"operation":"PAYMENT_APPROVED",...}
```

### Test 3: Rate Limiting

```bash
# Ejecutar 15 veces en bucle
for i in {1..15}; do curl ...; done

# Primera 10: 200 OK
# Última 5: 429 Too Many Requests
```

---

## 🎓 Resumen

| Feature | Uso | Beneficio |
|---------|-----|----------|
| OrderNumber | Automático | Órdenes legibles |
| Logger | Automático | Auditoría completa |
| Rate Limiting | Automático | Protección contra abuso |
| Webhook Verification | Automático | Seguridad |
| Detalles de Pago | Automático | Historial |
| Duplicado Detection | Automático | Sin double-charging |

**Todo funciona automáticamente** → No requiere cambios en frontend ni en lógica de aplicación.

