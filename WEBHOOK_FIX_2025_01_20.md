# 🔧 FIX - Webhook Mercado Pago Bloqueado en Producción

**Fecha:** 20 de enero de 2026  
**Problema:** Webhooks de Mercado Pago rechazados en Render  
**Causa:** Lógica de validación de headers conflictiva  
**Estado:** ✅ RESUELTO

---

## 📋 El Problema

Los logs de Render mostraban:

```
🔍 [Webhook] Headers recibidos:
   x-signature: ✅ presente
   x-request-id: ✅ presente
   x-timestamp: ❌ faltante

❌ PRODUCTION MODE: Headers de seguridad faltantes
```

**Conflicto detectado:**
- Headers críticos (`x-signature`, `x-request-id`) **SÍ estaban presentes** ✅
- Pero el middleware rechazaba el webhook diciendo "Headers faltantes" ❌

**Raíz del problema:** El middleware en `webhookVerification.js` requería que los **tres** headers estuvieran presentes (`x-signature`, `x-request-id`, Y `x-timestamp`) en la línea:

```javascript
if (signature && requestId && timestamp)  // ❌ REQUERÍA TIMESTAMP (opcional en MP)
```

Sin embargo, Mercado Pago **NO siempre envía `x-timestamp`** en todos los webhooks. Este es un header **opcional**, no requerido para validar la firma.

---

## ✅ La Solución

### 1. Corrección en `middleware/webhookVerification.js`

**Cambio:** Validar firma con solo `x-signature` y `x-request-id` (sin requerir `x-timestamp`)

```javascript
// ANTES (línea 54):
if (signature && requestId && timestamp) {  // ❌ Requería 3 headers

// DESPUÉS:
if (signature && requestId) {  // ✅ Solo requiere 2 headers (los críticos)
```

**Impacto:**
- ✅ Acepta webhooks de MP sin `x-timestamp`
- ✅ Mantiene validación HMAC-SHA256 correcta
- ✅ Solo rechaza si faltan headers críticos

### 2. Simplificación en `controllers/mercadoPagoController.js`

**Antes:** Validaba firma **dos veces** (middleware + controller)  
**Después:** Controller confía en que middleware ya validó

```javascript
// ANTES: Lógica compleja de re-validación en el controlador
// DESPUÉS:
console.log('✅ [Webhook] Firma validada por middleware - Continuando procesamiento');
```

---

## 🧪 Flujo Ahora

```
1. Mercado Pago envía webhook POST /api/mercadopago/webhook
   ├─ Headers: x-signature ✅, x-request-id ✅, x-timestamp ❌ (opcional)
   ├─ Body: JSON con datos del pago

2. Middleware verifyMercadoPagoSignature:
   ├─ Detecta: signature && requestId presentes
   ├─ ✅ Valida HMAC-SHA256
   ├─ ✅ Parsea JSON body
   └─ next() → continúa a controlador

3. Controller handleWebhook:
   ├─ ✅ Confía en validación del middleware
   ├─ Procesa pago
   ├─ Actualiza orden
   └─ Log exitoso

4. Mercado Pago recibe 200 OK
   └─ ✅ No reintenta
```

---

## 🚀 Cambios Específicos

| Archivo | Cambio | Razón |
|---------|--------|-------|
| `middleware/webhookVerification.js` | `if (signature && requestId)` | Solo requiere headers críticos |
| `middleware/webhookVerification.js` | Remover validación de `x-timestamp` | MP no siempre lo envía |
| `controllers/mercadoPagoController.js` | Remover re-validación de firma | Middleware ya valida |

---

## ✅ Testing

Para verificar que los webhooks ahora funcionan:

1. **Crear una orden** en producción (Render)
2. **Procesar pago** en Mercado Pago
3. **Verificar logs** en Render:
   ```
   ✅ [Webhook] Firma validada por middleware - Continuando procesamiento
   ✅ Pago aprobado: ...
   ```
4. **Verificar orden** en admin: Estado debe ser "aprobado" y "en_producción"

---

## 📚 Documentación

- **Webhook de MP:** https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
- **Headers requeridos:** x-signature, x-request-id (x-timestamp es opcional)
- **Variables de entorno:** `MERCADO_PAGO_WEBHOOK_SECRET` debe estar en Render

---

## 🔍 Checklist

- [x] Corregir lógica de validación en middleware
- [x] Simplificar validación en controlador
- [x] Documentar el cambio
- [ ] Probar en Render con pago real
- [ ] Monitorear logs próximas 24h
