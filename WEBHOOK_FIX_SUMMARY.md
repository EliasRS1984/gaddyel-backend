# 🔧 WEBHOOK FIX - Commit 5235be0

**Fecha:** 27 de enero de 2026  
**Estado:** ✅ Desplegado

## 🎯 Resumen

El middleware `mongoSanitize()` estaba **bloqueando todos los webhooks de Mercado Pago** antes de que llegaran al handler.

**Síntoma visible:**
- Pagos rechazados NO se eliminaban de la BD
- Estados de pago NO se actualizaban
- Admin mostraba órdenes "pendiente" indefinidamente

**Evidencia en logs:**
```
[SECURITY] Intento de NoSQL injection bloqueado
path: '/api/webhooks/mercadopago'
```

## ✅ Solución

Registrar el webhook **ANTES** de `mongoSanitize()` en el orden de middleware:

```javascript
// ✅ PRIMERO (línea 98)
app.use("/api/webhooks", mercadoPagoWebhookRoutes);

// DESPUÉS (línea 145+)
app.use(cors());
app.use(express.json());
app.use(mongoSanitize({
    // Excluir /api/webhooks de logging
}));
```

## 📦 Cambios

- **src/index.js**: Mover webhook a línea 98 (ANTES de mongoSanitize)
- **src/routes/mercadoPagoWebhookRoutes.js**: Agregar logging de IP y query params

## 🧪 Verificación

```
1. Abre Render Dashboard → gaddyel-backend → Logs
2. Haz un pago rechazado en MP
3. Busca en logs: "🔔 [Webhook MP]"
   ✅ Si aparece → webhook está siendo procesado
   ✅ Si ves "✅ Firma validada" → HMAC OK
   ✅ Si ves "🗑️ Eliminando orden" → orden eliminada
4. Admin: Orden NO debe aparecer (fue eliminada)
```

## 📊 Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Webhook** | ❌ BLOQUEADO | ✅ Procesado |
| **Órdenes rechazadas** | ❌ Permanecen | ✅ Eliminadas |
| **Estados de pago** | ❌ No se actualizan | ✅ En tiempo real |
| **Admin** | ❌ Incorrecta | ✅ Correcta |

## 📚 Documentación

- **WEBHOOK_VERIFICATION_STEPS.md** - Guía completa de verificación
- **docs/architecture/ADR-005** - Decisión arquitectónica detallada

---

**Próxima acción:** Hacer un test de pago rechazado y verificar que se elimine correctamente del admin.
