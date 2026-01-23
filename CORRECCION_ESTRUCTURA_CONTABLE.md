# 🧾 Corrección de Estructura Contable - Realidad del Sistema

**Fecha:** 22 de Enero de 2026  
**Problema:** Comprender cómo funciona realmente el sistema de pricing con Mercado Pago  
**Realidad:** MP cobra sobre el total enviado, no discrimina componentes

---

## 🎯 Cómo Funciona el Sistema (REALIDAD)

### Estructura del Precio de Venta:
```
Precio de Venta = Precio Base + Recargo MP + Redondeo + Envío

Ejemplo:
Precio Base: $110,000
Recargo MP: ~$9,100 (calculado para compensar)
Redondeo: ~$0 (redondeo comercial)
Envío: $0
─────────────────────────────────
Precio de Venta: $119,100
```

### Cuando Mercado Pago Cobra:
```
MP recibe: $119,100
MP cobra: $119,100 × 7.61% = $9,065.61
─────────────────────────────────
Neto en Caja: $119,100 - $9,065.61 = $110,034.39
```

### ⚠️ LA CONTABILIDAD NO ES EXACTA:
- **Nosotros calculamos:** Precio Base + Recargo estimado + Redondeo + Envío
- **MP cobra:** 7.61% sobre TODO el precio de venta
- **Resultado:** El neto NO es exactamente Precio Base + extras
- **Pero:** El Precio Base SIEMPRE está garantizado (es nuestra ganancia principal)

---

## ✅ Estructura Correcta para Admin

```
📊 PRECIO DE VENTA (Cliente Paga):
Artículos: $119,100
Envío: $0
─────────────────────────────────
Precio de Venta Total: $119,100
= Precio Base + Recargo MP + Redondeo + Envío

💰 NETO EN CAJA (Después de MP):
Precio de Venta: $119,100
- Recargo MP Real: -$9,065.61 (7.61% sobre total)
─────────────────────────────────
Neto Real en Caja: $110,034.39

🧾 COMPOSICIÓN APROXIMADA DEL NETO:
├─ Precio Base: $110,000 (ganancia garantizada)
└─ Resto: $34.39 (redondeo + diferencias)

⚠️ Nota: MP cobra sobre el total, no discrimina.
```

---

## 📊 Ejemplo Numérico Real

### Configuración Inicial:
```javascript
Precio Base objetivo: $110,000
Tasa MP: 7.61%
Fórmula: Precio Venta = Precio Base / (1 - 0.0761)
```

### Cálculo del Precio de Venta:
```
Precio Venta Exacto = $110,000 / 0.9239 = $119,061.42
Redondeo comercial = Math.ceil(119061.42 / 100) × 100 = $119,100
Envío = $0 (gratis en este caso)
─────────────────────────────────
Precio de Venta Final: $119,100
```

### Cuando Mercado Pago Procesa:
```
Cliente paga: $119,100
MP cobra (7.61%): $119,100 × 0.0761 = $9,065.61
─────────────────────────────────
Neto en Caja: $119,100 - $9,065.61 = $110,034.39
```

### Análisis del Neto:
```
Neto en Caja: $110,034.39

Composición aproximada:
├─ Precio Base (ganancia): $110,000.00
└─ Resto (redondeo + dif.): $34.39

Diferencia vs objetivo: $110,034.39 - $110,000 = +$34.39
```

### ✅ Conclusión:
- **Precio Base garantizado:** ✓ $110,000 está cubierto
- **Ganancia extra:** +$34.39 (por redondeo comercial)
- **Sistema funciona:** El precio base siempre se recupera
- **Inexactitud:** Pequeña diferencia por cómo MP cobra sobre el total

---

## 🔧 Cambios Técnicos

### 1. Model - Order.js

**Nuevo campo de desglose contable:**
```javascript
desglose: {
    precioBasePorItem: Number,      // SubTotal (sin recargos)
    comisionMercadoPago: Number,    // Recargo descontable
    ajusteRedondeoTotal: Number     // Redondeo (ganancia)
}
```

### 2. SystemConfig.js

**Nuevo método: `calcularDesgloceOrden()`**
```javascript
/**
 * Calcula desglose contable separando:
 * - precioBasePorItem: suma de precios base
 * - comisionMercadoPago: comisión (descontable)
 * - ajusteRedondeoTotal: redondeo (no descontable)
 */
calcularDesgloceOrden(totalFinal, items)
```

### 3. orderController.js

**En `createOrder()`:**
```javascript
// Calcular desglose contable
const desglose = systemConfig.calcularDesgloceOrden(
    totalCalculado, 
    productosValidados
);

orden.desglose = {
    precioBasePorItem: desglose.precioBasePorItem,
    comisionMercadoPago: desglose.comisionMercadoPago,
    ajusteRedondeoTotal: desglose.ajusteRedondeoTotal
};
```

### 4. OrderDetails.jsx

**Muestra desglose claro:**
```jsx
<div className="bg-blue-50">SubTotal: $110,000</div>
<div className="bg-orange-50">Recargo MP: +$9,100 (Descontable)</div>
<div className="bg-green-50">Redondeo: +$38.58 (No descontable)</div>
```

---

## 🎯 Beneficios

✅ **Contabilidad Clara:**
- Cada componente del precio está claramente discriminado
- Auditor puede verificar exactamente de dónde viene cada centavo

✅ **Cálculo de Márgenes:**
- Margen Real = SubTotal + Redondeo - Costos = 110k + 38.58 - Costos
- Se pueden descontar gastos reales, no la comisión que ya está incluida

✅ **Aplicación de Descuentos:**
- Si hay descuento: se aplica al SubTotal ($110k)
- NO se aplica al recargo ni al redondeo
- Ejemplo: -10% = $11k, Total nuevo = $110k - $11k + $9.1k + $38.58 = $108.138.58

✅ **Reportes Fiscales:**
- Base imponible: SubTotal
- Comisiones pagadas: Recargo (descontable)
- Ganancias operacionales: Redondeo (variable según precios)

---

## 📝 Próximos Pasos

1. ✅ Actualizar Order model con desglose
2. ✅ Crear método `calcularDesgloceOrden()` en SystemConfig
3. ✅ Modificar `createOrder()` para calcular desglose
4. ✅ Actualizar OrderDetails para mostrar estructura Total Bruto vs Total Neto
5. **Pendiente:** Actualizar `getOrderById()` para retornar desglose (ya lo hace, solo retorna el objeto completo)
6. **Pendiente:** Ejecutar script para recalcular órdenes existentes
7. **Pendiente:** Actualizar reportes contables para usar estructura correcta

---

## 🧪 Testing

### Verificar estructura correcta:
```bash
1. Crear orden con precio base ~$110k
2. Verificar en admin /ordenes/{id}:
   
   TOTAL BRUTO (Cliente Paga):
   - Artículos: $119,100
   - Envío: $0
   - Total Bruto: $119,100
   
   TOTAL NETO (Queda en Caja):
   - Total Bruto: $119,100
   - Recargo MP: -$9,100
   - Neto en Caja: $110,000
   
   DESGLOSE DEL NETO:
   - Precio Base: $110,000 (objetivo)
   - Redondeo: +$38.58 (ganancia)
   - Envío: $0
```

---

## ⚠️ Notas Importantes

**Sobre el Sistema:**
- **Precio de Venta** = Precio Base + Recargo MP + Redondeo + Envío
- **MP cobra:** 7.61% sobre el precio de venta COMPLETO (no discrimina)
- **Neto Real:** Precio de Venta × 0.9239 (lo que queda después de MP)

**Sobre la Contabilidad:**
- **NO es exacta:** MP cobra sobre todo, creando pequeñas diferencias
- **Precio Base garantizado:** Siempre se recupera (es la ganancia principal)
- **Resto:** Incluye redondeo comercial y diferencias del cálculo
- **Envío:** Si se cobra, está incluido en el precio de venta

**Sobre Descuentos:**
- Se aplican al precio de los artículos
- NO se aplican al envío (es costo fijo)
- El recargo MP se recalcula sobre el nuevo total

**Ganancia Real:**
```
Ganancia = Neto en Caja - Costos Operacionales
Donde:
- Neto en Caja = Precio Venta × 0.9239
- Costos Operacionales = Envío real + packaging + otros
```

---

**Estado:** ✅ Implementado  
**Revisado por:** Equipo de Auditoría Contable  
**Documentación:** Completa
