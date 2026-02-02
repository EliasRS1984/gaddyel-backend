# ADR-005: Webhook Bloqueado por mongoSanitize - Solución

**Fecha:** 27 de enero de 2026  
**Estado:** ✅ RESUELTO  
**Impacto:** CRÍTICO - Webhooks de Mercado Pago no estaban siendo procesados

---

## 1. Problema Identificado

### Síntoma
Los webhooks de Mercado Pago **NO estaban siendo procesados**, causando que:
- Órdenes rechazadas NO se eliminaban de la BD
- Estados de pago NO se actualizaban (estadoPago)
- Información de pago NO se guardaba
- Admin mostraba órdenes "pendiente" indefinidamente

### Causa Raíz
**Middleware `mongoSanitize()` estaba bloqueando todos los webhooks de MP**

```
Request HTTP → mongoSanitize() → "⚠️ Intento de NoSQL injection bloqueado"
                                  ↓ RECHAZA → Nunca llega al handler del webhook
```

#### Por qué mongoSanitize bloqueaba:
1. Mercado Pago envía parámetros de consulta con caracteres especiales
2. `mongoSanitize()` interpreta caracteres como `$`, `{`, `}` como inyección NoSQL
3. Ejemplo típico: `?query=$regex=...&other=...`
4. Middleware bloqueaba legítimamente, pero sin distinguir webhooks

#### Evidencia en Logs (27 enero 2026, 01:16 UTC)
```
2026-01-28T01:16:11.431601421Z [SECURITY 2026-01-28T01:16:11.431Z] Intento de NoSQL injection bloqueado
{ ip: '10.19.132.131', key: 'query', path: '/api/webhooks/mercadopago' }
```

---

## 2. Solución Implementada

### Enfoque: Registrar webhook ANTES de todo middleware de sanitización

**Antes (INCORRECTO):**
```javascript
// Orden problemático:
app.use(cors());
app.use(express.json());
app.use(mongoSanitize());  // ← BLOQUEA webhooks
app.use("/api/webhooks", mercadoPagoWebhookRoutes);  // ← Nunca llega aquí
```

**Después (CORRECTO):**
```javascript
// Orden correcto:
app.use("/api/webhooks", mercadoPagoWebhookRoutes);  // ← PRIMERO, sin filtros
app.use(cors());
app.use(express.json());
app.use(mongoSanitize({
    // ✅ Excluir /api/webhooks de logging de intentos bloqueados
    onSanitize: ({ req }) => {
        if (!req.path.includes('/api/webhooks')) {
            logger.security(`Intento de NoSQL injection bloqueado`, ...);
        }
    }
}));
```

### Cambios Realizados

#### src/index.js
1. **Línea 98**: Registrar `/api/webhooks` en la línea 98 (MUY al inicio)
2. **Línea 167-180**: `mongoSanitize()` excluye logging para `/api/webhooks`
3. **Línea 239**: Remover duplicación (webhook ya registrado arriba)

#### src/routes/mercadoPagoWebhookRoutes.js
1. **Líneas 20-23**: Agregar logging de query parameters de MP
2. **Línea 18**: Registrar IP de origen para debugging

---

## 3. Flujo de Datos - Antes vs. Después

### Antes (BLOQUEADO)
```
1. Mercado Pago POST → /api/webhooks/mercadopago?payment_id=123&status=rejected
2. Express recibe request
3. mongoSanitize() analiza query params
4. Encuentra caracteres especiales → BLOQUEA
5. Logs: "[SECURITY] Intento de NoSQL injection bloqueado"
6. ❌ Webhook nunca llega a MercadoPagoService
7. ❌ Orden NO se elimina
8. ❌ Estado NO se actualiza
```

### Después (FUNCIONANDO)
```
1. Mercado Pago POST → /api/webhooks/mercadopago
2. Express PRIMERO chequea /api/webhooks routes
3. 🔔 Webhook handler se ejecuta ANTES de mongoSanitize
4. Valida firma HMAC
5. ✅ MercadoPagoService.processWebhookNotification()
6. ✅ Orden se elimina si fue rechazada
7. ✅ Estado se actualiza a estadoPago='approved'
8. ✅ Información de pago se guarda en order.payment.mercadoPago
```

---

## 4. Seguridad

### ¿Es seguro permitir webhooks sin mongoSanitize?

**SÍ**, porque:

1. **Webhook valida firma HMAC**
   - Solo Mercado Pago puede crear webhooks válidos
   - Falsificadores serían rechazados por firma inválida
   
2. **Body se parsea como JSON limpio**
   - Solo propiedades de MP se aceptan
   - No ejecuta código dinámico

3. **Sigue siendo sanitizado**
   - `mongoSanitize()` continúa para todas las otras rutas
   - Solo /api/webhooks está excluido

4. **Logging de actividad**
   - Cada webhook se registra con IP, timestamp, resultado
   - Intentos fallidos se registran en OrderEventLog

---

## 5. Validación Post-Despliegue

### Checklist de Verificación
```
✅ Backend deploy (Commit 5235be0)
✅ Webhook registrado en línea 98
✅ mongoSanitize.onSanitize() filtra /api/webhooks (línea 174)
✅ Logs incluyen IP y query params
✅ MercadoPagoService.validateWebhookSignature() funciona
✅ OrderEventLog registra eventos de webhook
```

### Pasos de Testing
1. **Hacer pago rechazado en MP**
   - Orden creada: OK ✅
   - Prefencia MP creada: OK ✅
   - Usuario rechaza pago en MP

2. **Monitorear logs en Render**
   - Buscar: `🔔 [Webhook MP]`
   - Si aparece: Webhook llega ✅
   - Buscar: `Firma validada`
   - Si aparece: HMAC OK ✅
   - Buscar: `🗑️ Eliminando orden`
   - Si aparece: Orden eliminada ✅

3. **Verificar Admin**
   - Orden NO debe aparecer en lista
   - No debe existir en MongoDB
   - OrderEventLog tiene registro de eliminación

---

## 6. Diferencia con Implementación Anterior

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Registro webhook** | Línea 239 (después de sanitización) | Línea 98 (ANTES de sanitización) |
| **Procesamiento MP** | ❌ BLOQUEADO | ✅ EJECUTADO |
| **Órdenes rechazadas** | ❌ Persistían en BD | ✅ Eliminadas |
| **Estados de pago** | ❌ No se actualizaban | ✅ Actualizados |
| **Logs de webhook** | [SECURITY] bloqueado | 🔔 [Webhook MP] procesado |

---

## 7. Impacto en Flujos

### Pago Aprobado
```
1. Mercado Pago webhook: { status: 'approved' }
2. ✅ MercadoPagoService procesa
3. ✅ estadoPago = 'approved'
4. ✅ estadoPedido = 'en_produccion'
5. ✅ Elimina TTL (expiresAt)
6. ✅ Admin ve orden con estado actualizado
```

### Pago Rechazado
```
1. Mercado Pago webhook: { status: 'rejected', statusDetail: 'insufficient_funds' }
2. ✅ MercadoPagoService procesa
3. ✅ OrderEventLog.create() (auditoría)
4. ✅ Order.findByIdAndDelete() (limpia BD)
5. ✅ Admin NO ve orden (fue eliminada)
```

### Pago Pendiente (Transferencia Bancaria)
```
1. Mercado Pago webhook: { status: 'pending' }
2. ✅ MercadoPagoService procesa
3. ✅ estadoPago = 'pending'
4. ✅ expiresAt extendido a 7 días
5. ✅ Admin ve orden con badge "Pendiente Confirmación"
```

---

## 8. Conclusión

El webhook de Mercado Pago **ahora funciona correctamente** porque:
1. Se registra ANTES de mongoSanitize
2. HMAC valida autenticidad
3. Orden se procesa completamente
4. Estados se actualizan
5. Órdenes rechazadas se eliminan

**Próximas mejoras:**
- [ ] Agregar retry logic con exponential backoff
- [ ] Implementar fallback con polling API de MP
- [ ] Dashboard de webhook health check
- [ ] Alertas si webhook no procesa en 5+ minutos

