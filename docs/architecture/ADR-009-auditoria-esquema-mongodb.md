# ADR-009: Auditoría y Optimización del Esquema MongoDB

**Fecha**: 2026-02-03  
**Estado**: Propuesto  
**Contexto**: Auditoría completa del esquema detectó campos legacy, índices duplicados y colecciones no utilizadas.

---

## 🔍 Problemas Identificados

### 1. Campos Legacy en Order.js

| Campo Legacy | Campo Nuevo | Acción |
|--------------|-------------|--------|
| `mercadoPagoId` | `payment.mercadoPago.preferenceId` | Deprecar |
| `mercadoPagoPaymentId` | `payment.mercadoPago.paymentId` | Deprecar |
| `mercadoPagoCheckoutUrl` | `payment.mercadoPago.initPoint` | Deprecar |
| `fechaCreacion` | `createdAt` (timestamps) | Deprecar |
| `direccionEntrega` | `datosComprador.direccion` | Deprecar |

**Impacto**: 5 campos duplicados → Simplicidad del esquema

---

### 2. Índices Duplicados/Redundantes

```javascript
// ❌ ANTES (líneas 413-416 + 437-440)
orderSchema.index({ clienteId: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPago: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPedido: 1, fechaCreacion: -1 });
orderSchema.index({ 'datosComprador.email': 1 });

// Duplicados al final:
orderSchema.index({ clienteId: 1, createdAt: -1 }); // ← DUPLICADO
orderSchema.index({ estadoPago: 1 }); // ← REDUNDANTE
orderSchema.index({ estadoPedido: 1, createdAt: -1 }); // ← DUPLICADO
```

**Problema**: MongoDB crea índices dobles innecesarios → Consumo de RAM y espacio.

---

### 3. Colecciones No Utilizadas

| Modelo | Uso Detectado | Acción Recomendada |
|--------|---------------|-------------------|
| `AdminUser.js` | ❌ NO se importa | **Eliminar** (usar Admin.js) |
| `WebhookLog.js` | ❌ NO se importa | **Eliminar** (usar OrderEventLog) |
| `RefreshToken.js` | ⚠️ Posible uso en auth | **Verificar** y eliminar si no se usa |
| `CarouselImage.js` | ✅ Admin lo usa | **Mantener** |
| `PaymentConfig.js` | ✅ systemConfigController | **Mantener** |
| `SystemConfig.js` | ✅ En uso | **Mantener** |

---

### 4. Inconsistencias de Naming

```javascript
// ❌ Inconsistente
metododePago: String  // ← No es camelCase

// ✅ Debería ser
metodoDePago: String
```

---

## ✅ PLAN DE MEJORA (Fase 1 - Sin Romper Código)

### Paso 1: Marcar Campos Legacy como Deprecated

```javascript
// Order.js - Agregar comentarios de deprecación
// ❌ DEPRECATED: Usar payment.mercadoPago.preferenceId
mercadoPagoId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    select: false // ← No incluir en queries por defecto
},
```

### Paso 2: Eliminar Índices Duplicados

```javascript
// ANTES: 7 índices (líneas 413-440)
// DESPUÉS: 4 índices únicos

// ✅ Índices optimizados finales:
orderSchema.index({ clienteId: 1, createdAt: -1 }); // Query común
orderSchema.index({ estadoPago: 1, createdAt: -1 }); // Filtrado admin
orderSchema.index({ estadoPedido: 1, createdAt: -1 }); // Filtrado admin
orderSchema.index({ 'datosComprador.email': 1 }); // Búsqueda por email
orderSchema.index({ orderNumber: 1 }); // Búsqueda por código (ya existe por unique)
orderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index (ya existe)
```

**Beneficio**: -3 índices = Menos RAM, más velocidad en escrituras.

### Paso 3: Script de Migración (Copiar Datos Legacy → Nuevo)

```javascript
// scripts/migrate-order-legacy-fields.js
async function migrateOrders() {
  const orders = await Order.find({
    $or: [
      { mercadoPagoId: { $exists: true } },
      { fechaCreacion: { $exists: true } }
    ]
  });

  for (const order of orders) {
    const updates = {};

    // Migrar mercadoPagoId → payment.mercadoPago.preferenceId
    if (order.mercadoPagoId && !order.payment?.mercadoPago?.preferenceId) {
      updates['payment.mercadoPago.preferenceId'] = order.mercadoPagoId;
    }

    // Migrar fechaCreacion → createdAt
    if (order.fechaCreacion && !order.createdAt) {
      updates['createdAt'] = order.fechaCreacion;
    }

    if (Object.keys(updates).length > 0) {
      await Order.updateOne({ _id: order._id }, { $set: updates });
      console.log(`✅ Orden ${order._id} migrada`);
    }
  }
}
```

### Paso 4: Eliminar Colecciones No Usadas

```bash
# Eliminar archivos de modelos no usados
rm src/models/AdminUser.js
rm src/models/WebhookLog.js
```

---

## 📊 BENEFICIOS ESPERADOS

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Campos en Order | 40+ | 35 | -12% |
| Índices | 7 | 4 | -43% |
| RAM usada (índices) | ~35MB | ~20MB | -43% |
| Archivos de modelos | 11 | 9 | -18% |
| Complejidad esquema | Alta | Media | ↓ |

---

## 🚀 IMPLEMENTACIÓN SIN ROMPER CÓDIGO

### Fase 1 (Inmediata - 0 riesgo):
1. ✅ Eliminar índices duplicados (líneas 437-440)
2. ✅ Agregar `select: false` a campos legacy
3. ✅ Documentar deprecaciones con comentarios

### Fase 2 (Próxima semana - Bajo riesgo):
4. ✅ Ejecutar script de migración de datos
5. ✅ Verificar que ningún query usa campos legacy
6. ✅ Eliminar archivos de modelos no usados

### Fase 3 (Futuro - Mediano riesgo):
7. ⚠️ Eliminar físicamente campos legacy del esquema
8. ⚠️ Cambiar `metododePago` → `metodoDePago`

---

## ✅ MÉTRICAS DE ÉXITO

- [ ] Índices reducidos de 7 a 4
- [ ] RAM de MongoDB reducida en ~15MB
- [ ] Queries 10-15% más rápidas (menos índices = más velocidad escritura)
- [ ] Esquema más limpio y mantenible
- [ ] 0 errores en producción

---

## 📝 NOTAS

- **Compatibilidad**: Fase 1 y 2 NO rompen código existente
- **Rollback**: Si hay problemas, se pueden recrear índices fácilmente
- **Monitoreo**: Usar MongoDB Atlas Performance Advisor post-cambios
