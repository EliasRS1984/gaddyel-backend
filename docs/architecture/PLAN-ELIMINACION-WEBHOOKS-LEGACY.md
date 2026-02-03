# Auditoría de Webhooks - Sistema Dual Identificado

## 📊 RESULTADO FINAL DE AUDITORÍA

### ✅ Sistema ACTIVO (Webhook Principal):
- **URL MP configurada**: `https://gaddyel-backend.onrender.com/api/webhooks/mercadopago`
- **Ruta**: `POST /api/webhooks/mercadopago`
- **Archivo**: `src/routes/mercadoPagoWebhookRoutes.js`
- **Servicio**: `MercadoPagoService.js`
- **Logging**: `OrderEventLog.js`
- **Evidencia logs**: `🔔 [Webhook MP] ===== NUEVA NOTIFICACIÓN =====`
- **Estado**: ✅ FUNCIONANDO - Recibe webhooks de MP

### ⚠️ Sistema LEGACY (Rutas Checkout - EN USO):
- **Rutas**:
  - `POST /api/mercadopago/preferences` ← **USADO POR FRONTEND**
  - `GET /api/mercadopago/payment/:ordenId` ← **USADO POR FRONTEND**
  - `POST /api/mercadopago/webhook` ← **NO CONFIGURADO EN MP**
- **Archivo**: `src/controllers/mercadoPagoController.js` (588 líneas)
- **Logging**: `WebhookLog.js` (webhook legacy NO usado)
- **Frontend usa**: `Pagina-Gaddyel/src/Servicios/mercadoPagoService.js`
- **Estado**: ⚠️ PARCIALMENTE ACTIVO - Solo rutas de checkout

---

## 🔍 PROBLEMA IDENTIFICADO: DUPLICACIÓN DE FUNCIONALIDAD

### Duplicación 1: Creación de Preferencias MP

**Sistema LEGACY (en uso por frontend)**:
```javascript
// mercadoPagoController.js:39 - createCheckoutPreference()
POST /api/mercadopago/preferences
```

**Sistema NUEVO (disponible pero no usado)**:
```javascript
// MercadoPagoService.js:87 - createPreference()
await MercadoPagoService.createPreference(order);
```

### Duplicación 2: Logging de Webhooks

**Sistema LEGACY**:
```javascript
// WebhookLog.js - Modelo completo con esquema específico
const webhookLog = new WebhookLog({ type, externalId, payload });
```

**Sistema NUEVO**:
```javascript
// OrderEventLog.js - Modelo genérico de eventos
await OrderEventLog.create({ orderId, eventType, description, metadata });
```

---

## ❌ NO SE PUEDE ELIMINAR (Frontend depende):

1. **mercadoPagoController.js** - Frontend usa POST /preferences y GET /payment
2. **mercadoPagoRoutes.js** - Monta las rutas usadas por frontend
3. **WebhookLog.js** - Usado por mercadoPagoController (aunque webhook no está configurado)

---

## ✅ RECOMENDACIÓN: MANTENER AMBOS SISTEMAS TEMPORALMENTE

### Situación Actual:
- **Webhooks MP** → `/api/webhooks/mercadopago` (NUEVO - ACTIVO)
- **Checkout MP** → `/api/mercadopago/preferences` (LEGACY - ACTIVO)
- **Consulta Estado** → `/api/mercadopago/payment/:id` (LEGACY - ACTIVO)

### Plan de Unificación Futura (v2):

#### Fase 1: Migrar Frontend (Bajo riesgo)
```javascript
// CAMBIAR EN: Pagina-Gaddyel/src/Servicios/mercadoPagoService.js

// ANTES:
const response = await fetch(`${API_BASE}/api/mercadopago/preferences`, {...});

// DESPUÉS:
const response = await fetch(`${API_BASE}/api/pedidos`, {
  method: 'POST',
  body: JSON.stringify({ items, datosComprador })
});
// El orderController ya usa MercadoPagoService.createPreference() internamente
```

#### Fase 2: Deprecar Rutas Legacy
```javascript
// Agregar warning en mercadoPagoRoutes.js
router.post('/preferences', (req, res, next) => {
  console.warn('⚠️ DEPRECATED: Usar POST /api/pedidos en su lugar');
  next();
}, verifyToken, createCheckoutPreference);
```

#### Fase 3: Eliminar (Después de verificar frontend migrado)
```bash
rm src/controllers/mercadoPagoController.js
rm src/routes/mercadoPagoRoutes.js
rm src/models/WebhookLog.js
```

---

## 📊 COMPARATIVA DETALLADA

| Aspecto | Sistema NUEVO | Sistema LEGACY |
|---------|---------------|----------------|
| **Webhook URL** | `/api/webhooks/mercadopago` ✅ | `/api/mercadopago/webhook` ❌ |
| **Validación Firma** | ✅ HMAC SHA256 oficial | ⚠️ Middleware sin usar |
| **Logging** | OrderEventLog ✅ | WebhookLog ❌ |
| **Checkout** | MercadoPagoService ⚠️ | mercadoPagoController ✅ |
| **Usado por Frontend** | ❌ NO | ✅ SÍ |
| **Configurado en MP** | ✅ SÍ | ❌ NO (webhook) |

---

## 🎯 DECISIÓN FINAL

### ✅ MANTENER TODO (por ahora):
- `mercadoPagoController.js` - Frontend lo necesita
- `mercadoPagoRoutes.js` - Frontend lo necesita
- `WebhookLog.js` - Usado por mercadoPagoController
- `mercadoPagoWebhookRoutes.js` - Sistema activo de webhooks
- `OrderEventLog.js` - Sistema activo de webhooks

### 📝 DOCUMENTAR:
- Marcar mercadoPagoController.js como LEGACY
- Agregar warning logs cuando se usen rutas legacy
- Actualizar README con plan de migración

### 🚀 SIGUIENTE PASO:
Migrar frontend para que use `/api/pedidos` directamente en lugar de `/api/mercadopago/preferences`

---

## ✅ Validación de Duplicación

### Webhooks MP recibidos (logs Render):
```
🔔 [Webhook MP] ===== NUEVA NOTIFICACIÓN =====
   Timestamp: 2026-02-03T01:04:25.124Z
   Query Params: { id: '144572348452', topic: 'payment' }
```

**Confirmado**: Solo el sistema NUEVO recibe webhooks.

### Frontend usa (Pagina-Gaddyel):
```javascript
// src/Servicios/mercadoPagoService.js:57
await fetch(`${API_BASE}/api/mercadopago/preferences`, {
  method: 'POST',
  body: JSON.stringify({ ordenId, deviceId })
});
```

**Confirmado**: Frontend usa rutas LEGACY de checkout.
