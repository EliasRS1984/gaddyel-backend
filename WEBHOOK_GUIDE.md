# 🔔 Guía de Webhooks - Mercado Pago

Documentación completa sobre cómo configurar y manejar webhooks de Mercado Pago en Gaddyel E-Commerce.

## 📋 Tabla de Contenidos

- [¿Qué es un Webhook?](#qué-es-un-webhook)
- [Configuración en Mercado Pago](#configuración-en-mercado-pago)
- [Seguridad](#seguridad)
- [Tipos de Eventos](#tipos-de-eventos)
- [Estructura del Webhook](#estructura-del-webhook)
- [Respuestas Esperadas](#respuestas-esperadas)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## ¿Qué es un Webhook?

Un webhook es una notificación **push** que Mercado Pago envía a tu servidor cuando ocurre un evento importante (ej: pago aprobado).

### Ventajas vs Polling

| Aspecto | Webhook | Polling |
|--------|---------|---------|
| **Latencia** | Instantáneo | Demorado |
| **Carga de servidor** | Mínima | Alta |
| **Confiabilidad** | Alta con reintentos | Buena |
| **Costo** | Bajo | Medio |

---

## Configuración en Mercado Pago

### Paso 1: Acceder al Panel de Desarrollador

1. Ir a: https://www.mercadopago.com.ar/developers/es/dashboard
2. Seleccionar tu aplicación
3. Ir a **Configuración** → **Webhooks**

### Paso 2: Agregar URL de Webhook

```
URL: https://tudominio.com/api/webhooks/mercadopago
```

**En desarrollo con localhost:**

Opción A - Usar ngrok:
```bash
# Instalar ngrok
npm install -g ngrok

# En otra terminal
ngrok http 5000

# Usar la URL generada
# https://xxxx-xx-xxx-xx-xxx.ngrok.io/api/webhooks/mercadopago
```

Opción B - Usar localhost.run:
```bash
ssh -R 80:localhost:5000 localhost.run
```

### Paso 3: Seleccionar Eventos

Habilitar los siguientes eventos:

- ✅ `payment.created` - Pago creado
- ✅ `payment.updated` - Pago actualizado
- ⚠️ `payment.notification` - Notificación de pago (legacy)
- ⚠️ `merchant_order.created` - Orden de comerciante
- ⚠️ `merchant_order.updated` - Orden de comerciante actualizada

### Paso 4: Guardar Configuración

Mercado Pago enviará un webhook de test. Deberías recibir algo como:

```json
{
  "type": "payment",
  "data": {
    "id": 1234567890
  }
}
```

---

## 🔐 Seguridad

### Validar Firma HMAC

Mercado Pago firma cada webhook con HMAC-SHA256:

```
X-Signature: ts=1234567890,v1=abc123xyz789
X-Request-Id: 1234567890abcdef
```

**Cómo validar en Node.js:**

```javascript
const crypto = require('crypto');

function validateWebhookSignature(headers, body) {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];

  // Extraer valores
  const parts = xSignature.split(',');
  const timestamp = parts[0].split('=')[1];
  const signature = parts[1].split('=')[1];

  // Crear hash
  const data = `${xRequestId}:${body}`;
  const expectedHash = crypto
    .createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(data)
    .digest('hex');

  // Comparar
  return expectedHash === signature;
}
```

### Mejores Prácticas

✅ **Siempre** validar la firma antes de procesar
✅ **Obtener** los detalles del pago desde Mercado Pago (no confiar solo en el webhook)
✅ **Usar HTTPS** en producción
✅ **Mantener secreto** el `MERCADOPAGO_WEBHOOK_SECRET`
✅ **Implementar** reintentos para fallos transitorios
✅ **Loguear** todos los webhooks recibidos

❌ **No** confiar en los datos del webhook completamente
❌ **No** procesar webhooks duplicados sin validación
❌ **No** actualizar estado de orden sin confirmar en MP

---

## Tipos de Eventos

### payment.created

Se dispara cuando se **crea** un pago.

```json
{
  "type": "payment",
  "data": {
    "id": 1234567890
  }
}
```

### payment.updated

Se dispara cuando se **actualiza** un pago.

Estado posibles:
- `approved` - Pago aprobado ✅
- `rejected` - Pago rechazado ❌
- `pending` - Pago pendiente ⏳
- `cancelled` - Pago cancelado
- `refunded` - Pago reembolsado
- `in_process` - En procesamiento
- `charged_back` - Contracargo

### merchant_order.created / updated

Se dispara cuando se crea/actualiza una orden de comerciante (con múltiples pagos).

```json
{
  "type": "merchant_order",
  "data": {
    "id": 1234567890
  }
}
```

---

## Estructura del Webhook

### Request Completo

```http
POST /api/webhooks/mercadopago HTTP/1.1
Host: tudominio.com
Content-Type: application/json
X-Signature: ts=1234567890,v1=abc123def456
X-Request-Id: 1234567890abcdef
User-Agent: MP-Webhook/1.0

{
  "type": "payment",
  "data": {
    "id": 1234567890
  }
}
```

### Detalles Completos del Pago

Después de validar, obtener detalles:

```javascript
const payment = await MercadoPagoService.getPaymentDetails(paymentId);

{
  paymentId: 1234567890,
  status: "approved",
  statusDetail: "accredited",
  amount: 1500.00,
  currency: "ARS",
  paymentMethod: "master",
  paymentType: "card_payment",
  externalReference: "ORDER-12345",
  description: "Compra en Gaddyel",
  cardLastFour: "1234",
  cardBrand: "mastercard",
  installments: 1,
  issuerBank: "Banco de Prueba",
  approvalCode: "123456",
  createdAt: "2024-01-15T10:30:00Z",
  approvedAt: "2024-01-15T10:31:00Z"
}
```

---

## Respuestas Esperadas

### Response Exitoso (200)

```json
{
  "success": true,
  "data": {
    "orderNumber": 12345,
    "status": "approved",
    "message": "Pago aprobado"
  }
}
```

### Response Error (4xx)

```json
{
  "success": false,
  "error": "Firma de webhook inválida"
}
```

### Response Error (5xx)

```json
{
  "success": false,
  "error": "Error procesando webhook"
}
```

---

## Flujo Completo de un Pago

```
1. USUARIO completa pago en Mercado Pago
   ↓
2. MERCADO PAGO procesa pago
   ↓
3. MERCADO PAGO genera evento (payment.updated)
   ↓
4. MERCADO PAGO envía webhook:
   POST /api/webhooks/mercadopago
   X-Signature: ts=...,v1=...
   {
     "type": "payment",
     "data": { "id": 1234567890 }
   }
   ↓
5. TU SERVIDOR valida firma HMAC
   ↓
6. TU SERVIDOR obtiene detalles del pago:
   GET /v1/payments/1234567890
   ↓
7. TU SERVIDOR actualiza orden:
   - Si status=approved → Order.status='paid'
   - Si status=rejected → Order.status='failed'
   - Si status=pending → Order.status='pending_payment'
   ↓
8. TU SERVIDOR responde 200 OK
   ↓
9. TU SERVIDOR envía email de confirmación
   ↓
10. FRONTEND recibe notificación y redirige
```

---

## Testing

### Test Manual con Postman/cURL

```bash
# 1. Obtener WEBHOOK_SECRET
echo $MERCADOPAGO_WEBHOOK_SECRET

# 2. Crear REQUEST ID
REQUEST_ID=$(openssl rand -hex 16)

# 3. Crear body
BODY='{"type":"payment","data":{"id":1234567890}}'

# 4. Crear firma
SIGNATURE=$(echo -n "${REQUEST_ID}:${BODY}" | openssl dgst -sha256 -hmac "tu_webhook_secret" | sed 's/^.* //')

# 5. Enviar webhook
curl -X POST http://localhost:5000/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "X-Signature: ts=$(date +%s),v1=${SIGNATURE}" \
  -H "X-Request-Id: ${REQUEST_ID}" \
  -d "${BODY}"
```

### Test en NodeJS

```javascript
// test/webhook.test.js
const crypto = require('crypto');
const axios = require('axios');

async function testWebhook() {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const paymentId = 1234567890;
  const requestId = crypto.randomUUID();
  
  const body = JSON.stringify({
    type: 'payment',
    data: { id: paymentId }
  });
  
  // Crear firma
  const data = `${requestId}:${body}`;
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(data)
    .digest('hex');
  
  // Enviar
  const response = await axios.post(
    'http://localhost:5000/api/webhooks/mercadopago',
    JSON.parse(body),
    {
      headers: {
        'X-Signature': `ts=${Date.now()},v1=${signature}`,
        'X-Request-Id': requestId,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('Response:', response.data);
}

testWebhook();
```

---

## Troubleshooting

### "Firma de webhook inválida"

**Problema:** El webhook no pasa la validación de firma.

**Soluciones:**
1. ✅ Verificar que `MERCADOPAGO_WEBHOOK_SECRET` es correcto
2. ✅ Asegurarse que el body se valida como STRING, no objeto parseado
3. ✅ Verificar que se está usando HMAC-SHA256
4. ✅ Checar que no hay espacios extras en los datos

```javascript
// ❌ INCORRECTO
const body = req.body; // Object
const data = `${xRequestId}:${body}`; // "[object Object]"

// ✅ CORRECTO
const body = req.rawBody; // String original
const data = `${xRequestId}:${body}`;
```

### "Webhook no se dispara"

**Problema:** No estoy recibiendo webhooks.

**Soluciones:**
1. ✅ Verificar que la URL es accesible (usar ngrok en desarrollo)
2. ✅ Validar que tu firewall permite conexiones entrantes
3. ✅ Checar que el webhook está habilitado en panel MP
4. ✅ Ver logs de Mercado Pago (Dashboard → Webhooks)
5. ✅ Intentar reenviar manualmente desde panel

### "Webhook se recibe pero no actualiza orden"

**Problema:** El webhook se recibe pero no actualiza la orden.

**Soluciones:**
1. ✅ Validar que la orden existe (buscar por paymentId o external_reference)
2. ✅ Checar que el estado permite transición
3. ✅ Ver logs (`logs/webhooks.log`)
4. ✅ Validar que se obtienen detalles desde Mercado Pago correctamente

### "Webhook duplicado"

**Problema:** La misma orden se procesa múltiples veces.

**Soluciones:**
1. ✅ Usar `idempotencyKey` único por orden
2. ✅ Implementar validación de estado (no procesar si ya está pagado)
3. ✅ Usar transacciones en MongoDB

```javascript
// Proteger contra duplicados
if (order.status === 'paid') {
  return res.status(200).json({ 
    success: true, 
    message: 'Ya procesado' 
  });
}
```

### "Timeout del webhook"

**Problema:** Mercado Pago reporta timeout.

**Soluciones:**
1. ✅ Optimizar la base de datos (agregar índices)
2. ✅ Procesar webhook de forma asíncrona
3. ✅ Responder rápido (200 OK) antes de procesar

```javascript
// ✅ CORRECTO: Responder rápido
res.status(200).json({ success: true });

// Procesar en background
processWebhookAsync(paymentData).catch(logError);
```

---

## Manejo de Reintentos

Mercado Pago reintenta webhooks fallidos:

- **1er intento:** Inmediatamente
- **2do intento:** 5 segundos después
- **3er intento:** 27 segundos después
- **4to intento:** 2 minutos y 14 segundos después
- **5to intento:** 5 minutos y 2 segundos después
- ... hasta 72 horas

Implementar idempotencia:

```javascript
// No depender de orden de webhooks
const order = await Order.findById(orderId);

if (order.status === 'paid' && paymentData.status === 'approved') {
  // Ya procesado, solo retornar OK
  return res.status(200).json({ success: true });
}

// Procesar solo si necesario
if (order.status === 'pending_payment' && paymentData.status === 'approved') {
  // Procesar pago
}
```

---

## Recursos Útiles

- [Documentación Oficial MP](https://www.mercadopago.com.ar/developers/es/reference)
- [Webhook Tester](https://webhook.site) - Para testing
- [Postman Collection](https://github.com/gaddyel/webhook-collection.json)
- [Ejemplos en GitHub](https://github.com/mercadopago/webhook-examples)

---

**Última actualización:** 2024
**Versión:** 1.0.0
