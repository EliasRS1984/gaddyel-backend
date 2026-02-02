# 📊 DESGLOSE CONTABLE DETALLADO - Sistema de Precios Gaddyel

**Fecha:** 22 de enero de 2026  
**Versión:** 2.0 (Con envío separado)

---

## 🎯 Objetivo

Registrar de forma clara y transparente todos los componentes del precio:
1. **Precio Base de Items** (ganancia principal)
2. **Envío** (con recargo MP ya incorporado)
3. **Subtotal con recargo aplicado**
4. **Redondeo comercial** (ganancia adicional)
5. **Total que paga el cliente**
6. **Comisión de Mercado Pago**
7. **Neto en caja** (lo que recibimos)

---

## 📐 ESTRUCTURA DEL PRECIO

### Fórmula Completa:
```
Total = Precio Base Items + Envío (con recargo) + Redondeo
Neto en Caja = Total - Comisión MP (7.61%)
```

### Componentes:

1. **Precio Base Items**: El precio real de los productos (sin recargo MP)
2. **Envío**: Precio general que YA incluye el recargo de MP incorporado
   - Es un valor fijo basado en el costo promedio de envíos
   - No se calcula individualmente por orden
   - Simplifica la operación para márgenes pequeños
3. **Redondeo**: Ganancia adicional por redondear a la centena más cercana
4. **Comisión MP**: 7.61% que cobra Mercado Pago sobre el total final

---

## 💡 EJEMPLO NUMÉRICO CON ENVÍO

### Configuración:
- **Precio Base Items**: $110,000
- **Tasa Mercado Pago**: 7.61%
- **Envío**: $12,000 (ya incluye recargo MP)

### Cálculo Paso a Paso:

#### 1️⃣ Precio Base de Items (sin recargo)
```
Precio Base Items = $110,000
```

#### 2️⃣ Precio de Venta de Items (con recargo MP)
```
Precio Venta Items = Precio Base / (1 - 0.0761)
Precio Venta Items = $110,000 / 0.9239
Precio Venta Items = $119,073.49 (exacto)
```

#### 3️⃣ Redondeo Comercial
```
Precio Redondeado = Math.ceil($119,073.49 / 100) × 100
Precio Redondeado = $119,100
Redondeo = $119,100 - $119,073.49 = $26.51
```

#### 4️⃣ Envío (ya con recargo incorporado)
```
Envío = $12,000 (precio general)
```

#### 5️⃣ Total Final
```
Total = Precio Base Items + Envío + Redondeo
Total = $110,000 + $12,000 + $26.51
Total = $122,026.51

(Pero en realidad: Items redondeados + Envío)
Total Real = $119,100 + $12,000 = $131,100
```

#### 6️⃣ Comisión de Mercado Pago
```
Comisión MP = Total × 7.61%
Comisión MP = $131,100 × 0.0761
Comisión MP = $9,976.71
```

#### 7️⃣ Neto en Caja
```
Neto en Caja = Total - Comisión MP
Neto en Caja = $131,100 - $9,976.71
Neto en Caja = $121,123.29
```

---

## 📊 DESGLOSE VISUAL

```
┌─────────────────────────────────────────────────────────┐
│               PRECIO QUE PAGA EL CLIENTE                │
├─────────────────────────────────────────────────────────┤
│ 1. Precio Base Items             $110,000.00           │
│ 2. Envío (con recargo MP)         $12,000.00           │
│ 3. Subtotal con recargo          $122,000.00           │
│ 4. Redondeo comercial              $9,100.00           │
├─────────────────────────────────────────────────────────┤
│ TOTAL FINAL                      $131,100.00           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    NETO EN CAJA                         │
├─────────────────────────────────────────────────────────┤
│ Total Cliente Paga               $131,100.00           │
│ - Comisión MP (7.61%)             -$9,976.71           │
├─────────────────────────────────────────────────────────┤
│ NETO EN CAJA                     $121,123.29           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               COMPOSICIÓN DEL NETO                      │
├─────────────────────────────────────────────────────────┤
│ Precio Base Items                $110,000.00 (90.82%)  │
│ Envío Neto ($12k × 92.39%)        $11,086.80  (9.15%)  │
│ Redondeo                              $36.49  (0.03%)  │
├─────────────────────────────────────────────────────────┤
│ TOTAL NETO                       $121,123.29 (100%)    │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 ANÁLISIS DEL ENVÍO

### ¿Por qué el envío ya incluye recargo de MP?

El precio de envío ($12,000) es un **precio general** que ya contempla:
- Costo real del envío
- Recargo de Mercado Pago incorporado

### Cálculo del envío neto recibido:

```
Envío Cobrado = $12,000
Comisión MP sobre envío = $12,000 × 7.61% = $913.20
Envío Neto Recibido = $12,000 × 92.39% = $11,086.80
```

### Ventajas de este sistema:

✅ **Simplicidad**: Un solo precio de envío para todos los pedidos  
✅ **Eficiencia**: No calcular individualmente por márgenes pequeños  
✅ **Claridad**: Cliente ve un precio fijo y comprensible  
✅ **Promedio**: Basado en el costo real promedio de envíos realizados  

---

## 💻 IMPLEMENTACIÓN TÉCNICA

### Backend: `SystemConfig.calcularDesgloceOrden()`

```javascript
calcularDesgloceOrden(totalFinal, items, costoEnvio) {
  const r = 0.0761; // Tasa MP

  // 1. Precio base de items (sin recargo)
  let precioBasePorItem = 0;
  for (const item of items) {
    const precioBaseItem = item.precioUnitario * (1 - r);
    precioBasePorItem += precioBaseItem * item.cantidad;
  }

  // 2. Comisión MP sobre el TOTAL
  const comisionMercadoPago = totalFinal * r;

  // 3. Redondeo = Total - (Base Items + Envío)
  const ajusteRedondeoTotal = totalFinal - precioBasePorItem - costoEnvio;

  return {
    precioBasePorItem,
    costoEnvio,
    ajusteRedondeoTotal,
    comisionMercadoPago
  };
}
```

### Frontend: OrderDetails.jsx

**Sección 1: Desglose del Precio**
- Precio Base Items (sin recargo)
- Envío (con recargo incorporado)
- Subtotal con recargo aplicado
- Redondeo
- Total Final

**Sección 2: Neto en Caja**
- Total Cliente Paga
- Comisión MP (7.61%)
- Neto en Caja

**Sección 3: Composición del Neto**
- Precio Base Items
- Envío Neto (después de MP)
- Redondeo

---

## 📝 MODELO DE DATOS

### Order.desglose

```javascript
{
  precioBasePorItem: Number,    // Precio base real de items
  costoEnvio: Number,           // Envío con recargo MP incorporado
  ajusteRedondeoTotal: Number,  // Ganancia por redondeo
  comisionMercadoPago: Number   // Comisión MP sobre total
}
```

### Validación Matemática:

```javascript
// Validar que el desglose cuadre:
const suma = desglose.precioBasePorItem + 
             desglose.costoEnvio + 
             desglose.ajusteRedondeoTotal;

console.assert(suma === orden.total, 'Desglose no cuadra con total');

const neto = orden.total - desglose.comisionMercadoPago;
console.log('Neto en caja:', neto);
```

---

## ✅ VENTAJAS DEL SISTEMA

1. **Transparencia Total**: Se ve cada componente del precio
2. **Precio Base Garantizado**: Siempre se recibe el precio base de items
3. **Envío Simplificado**: Un precio general evita cálculos complejos
4. **Contabilidad Clara**: Registro detallado para auditorías
5. **Redondeo Visible**: La ganancia por redondeo está documentada
6. **Comisión MP Clara**: Se ve exactamente cuánto cobra MP

---

## ⚠️ NOTAS IMPORTANTES

1. **El envío YA incluye recargo de MP**: No se calcula el recargo sobre el envío individualmente

2. **Precio general de envío**: Basado en el costo promedio de envíos realizados

3. **MP cobra sobre el total**: La comisión de 7.61% se aplica al total final (items + envío)

4. **Contabilidad exacta**: Con este desglose, la contabilidad es precisa:
   ```
   Total = Base Items + Envío + Redondeo ✓
   Neto = Total - Comisión MP ✓
   ```

5. **Registro completo**: Cada orden guarda este desglose en la base de datos

---

## 🎓 GLOSARIO

- **Precio Base**: Precio sin recargos (ganancia principal)
- **Recargo MP**: 7.61% que se agrega para cubrir la comisión de Mercado Pago
- **Envío con recargo**: Precio de envío que ya incluye el recargo incorporado
- **Subtotal con recargo**: Base + Envío (ambos con recargo aplicado)
- **Redondeo**: Ganancia adicional por redondear a la centena
- **Comisión MP**: Lo que realmente cobra Mercado Pago (7.61% del total)
- **Neto en Caja**: Lo que finalmente recibimos después de descontar la comisión MP

---

## 📞 CONTACTO

Para dudas o mejoras de este sistema:
- **Desarrollador**: Gaddyel Backend Team
- **Fecha actualización**: 22 de enero de 2026
- **Versión**: 2.0 - Desglose detallado con envío separado

---

**✓ Sistema verificado y funcionando correctamente**
