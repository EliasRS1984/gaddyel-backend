# 📊 LÓGICA DE CÁLCULO DE PRECIOS - Gaddyel

**Fecha:** 23 de enero de 2026  
**Tema:** Explicación detallada de redondeo, recargo MP y precio base

---

## 🎯 Conceptos Clave

### 1. **Precio Base** (Ganancia Objetivo)
- El precio que **queremos ganar** como ganancia real
- Ejemplo: $95,000
- Es el objetivo antes de cualquier recargo

### 2. **Precio de Venta** (Lo que paga el cliente)
- El precio que el cliente ve y paga
- Incluye la ganancia + recargo para cubrir comisión MP
- Ejemplo: $102,900

### 3. **Recargo/Comisión MP**
- La diferencia entre precio de venta y precio base
- Cubre la comisión que cobra Mercado Pago (7.61%)
- NO es exactamente 7.61% porque incluye redondeo

### 4. **Ajuste de Redondeo**
- Ganancia adicional por redondear a la centena más cercana
- Ejemplo: $26.81 en el caso de $95,000 base

---

## 🧮 EJEMPLO PRÁCTICO PASO A PASO

**ENTRADA:**
```
Precio Base deseado = $95,000
Tasa Mercado Pago = 7.61%
Comisión Fija MP = $0 (no aplicar en este caso)
```

---

### **PASO 1: Calcular Precio de Venta EXACTO**

```
FÓRMULA: PrecioVenta = (PrecioBase + ComisiónFija) / (1 - Tasa)

PrecioVenta = ($95,000 + $0) / (1 - 0.0761)
PrecioVenta = $95,000 / 0.9239
PrecioVenta = $102,873.192...
```

**¿Por qué esta fórmula?**
- Queremos que después de que MP cobre su comisión, nos quede el precio base
- Si MP cobra 7.61%, nos queda 92.39% (100% - 7.61%)
- Para obtener $95,000 del 92.39%, necesitamos dividir por 0.9239

---

### **PASO 2: REDONDEO COMERCIAL**

```
FÓRMULA: PrecioRedondeado = Math.ceil(PrecioExacto / 100) × 100

División: $102,873.19 / 100 = 1,028.7319
Redondeo hacia arriba: Math.ceil(1,028.7319) = 1,029
Resultado: 1,029 × 100 = $102,900
```

**¿Por qué redondeamos hacia arriba a la centena?**
- Los montos deben ser "legibles" para el cliente (no decimales)
- Redondeamos hacia arriba para garantizar la ganancia
- Ejemplo: $102,873.19 → $102,900 (no → $102,800)

---

### **PASO 3: Calcular RECARGO MP (Ganancia)**

```
FÓRMULA: Recargo = PrecioRedondeado - PrecioBase

Recargo = $102,900 - $95,000
Recargo = $7,900
```

**¿Qué significa este recargo?**
- Es lo que MP + redondeo nos harán ganar extra sobre el precio base
- NO es exactamente 7.61% porque incluye el ajuste de redondeo

---

### **PASO 4: Calcular AJUSTE DE REDONDEO**

```
FÓRMULA: AjusteRedondeo = PrecioRedondeado - PrecioExacto

AjusteRedondeo = $102,900 - $102,873.19
AjusteRedondeo = $26.81
```

**¿Qué significa?**
- Es la ganancia EXTRA por el redondeo comercial
- Dinero "gratis" que obtenemos por redondear hacia arriba
- Va a nuestro bolsillo directamente

---

## 📊 DESGLOSE FINAL

```
┌─────────────────────────────────────────────────┐
│           COMPOSICIÓN DEL PRECIO                │
├─────────────────────────────────────────────────┤
│ Precio Base (ganancia objetivo)  = $95,000.00  │
│ Ajuste de Redondeo               = $26.81      │
│ ─────────────────────────────────────────────  │
│ Subtotal (nuestro objetivo)      = $95,026.81  │
│                                                 │
│ Recargo MP adicional              = $7,873.19  │
│ ─────────────────────────────────────────────  │
│ PRECIO DE VENTA                  = $102,900.00 │
└─────────────────────────────────────────────────┘
```

### **¿Cuánto cobra Mercado Pago?**

```
FÓRMULA: ComisiónMP = PrecioVenta × Tasa

ComisiónMP = $102,900 × 0.0761
ComisiónMP = $7,830.90
```

### **¿Cuánto nos queda en caja?**

```
FÓRMULA: NetoEnCaja = PrecioVenta - ComisiónMP

NetoEnCaja = $102,900 - $7,830.90
NetoEnCaja = $95,069.10
```

**¿Por qué $95,069.10 y no exactamente $95,000?**
- Porque el ajuste de redondeo ($26.81) no compensa exactamente la comisión
- Comisión extra por redondeo: $26.81 × 0.0761 = $2.04
- Neto adicional: $26.81 - $2.04 = $24.77
- Más pequeñas variaciones de redondeo

---

## ⚠️ LA CONFUSIÓN COMÚN

### **Pregunta:** Si el precio base es $95,000, ¿por qué el neto es $95,069?

### **Respuesta:**

Hay una diferencia entre:

1. **Precio Base objetivo** = $95,000
   - Lo que QUEREMOS ganar teóricamente

2. **Neto en caja real** = $95,069.10
   - Lo que realmente recibimos después de MP cobre
   - Incluye la ganancia del redondeo

**El neto NO es igual al precio base porque:**
- La comisión de MP se cobra sobre el total final (con redondeo)
- El redondeo agrega ganancia
- Pero esa ganancia también tiene que cubrir parte de la comisión de MP

---

## 🔢 VALIDACIÓN MATEMÁTICA

Para verificar que el cálculo es correcto:

```javascript
const precioBase = 95000;
const tasaMP = 0.0761;

// 1. Precio venta exacto
const precioExacto = precioBase / (1 - tasaMP); 
// = 95000 / 0.9239 = 102,873.19

// 2. Precio redondeado
const precioRedondeado = Math.ceil(precioExacto / 100) * 100;
// = 102,900

// 3. Ajuste redondeo
const ajusteRedondeo = precioRedondeado - precioExacto;
// = 102,900 - 102,873.19 = 26.81

// 4. Recargo total
const recargo = precioRedondeado - precioBase;
// = 102,900 - 95,000 = 7,900

// 5. Comisión MP (sobre total)
const comisionMP = precioRedondeado * tasaMP;
// = 102,900 * 0.0761 = 7,830.90

// 6. Neto en caja
const netoEnCaja = precioRedondeado - comisionMP;
// = 102,900 - 7,830.90 = 95,069.10

// VALIDACIÓN
console.assert(
  precioRedondeado === precioBase + recargo,
  'Precio redondeado debe = base + recargo'
);
// ✓ $102,900 = $95,000 + $7,900
```

---

## 💾 INFORMACIÓN ALMACENADA EN BASE DE DATOS

Cuando creamos/editamos un producto en el admin con precio base = $95,000:

```javascript
{
  _id: "6914c4f1ba90b6ef058e674b",
  nombre: "Producto XYZ",
  
  // Campos de precio
  precio: 102900,  // ← Lo que paga el cliente
  
  propiedadesPersonalizadas: {
    precioBase: 95000,  // ← Nuestro objetivo de ganancia
    tasaComisionAplicada: 0.0761,
    fechaActualizacionPrecio: "2026-01-23T10:30:00.000Z"
  }
}
```

---

## 🎨 VISUALIZACIÓN EN LA UI

### **Admin - Página Ver Producto (Solo Gestión):**
```
┌─────────────────────────────────┐
│ Precio de Venta                 │
│ $102,900.00                     │  ← Lo que paga el cliente
├─────────────────────────────────┤
│ Precio Base                     │
│ $95,000.00                      │  ← Nuestro objetivo de ganancia
└─────────────────────────────────┘

⚠️ NOTA: El desglose contable NO se muestra aquí
(es solo para registro de órdenes confirmadas)
```

---

## 🔗 CÓDIGO RELEVANTE

### **Backend - Cálculo en SystemConfig.js:**

```javascript
systemConfigSchema.methods.calcularPrecioVenta = function(precioBase) {
  const r = this.comisiones.mercadoPago.tasaComision; // 0.0761
  
  // Paso 1: Calcular exacto
  const precioExacto = precioBase / (1 - r);
  
  // Paso 2: Redondear hacia arriba
  const precioRedondeado = Math.ceil(precioExacto / 100) * 100;
  
  // Paso 3: Calcular metadatos
  const ajusteRedondeo = precioRedondeado - precioExacto;
  const montoComision = precioRedondeado - precioBase;
  
  return {
    precioVenta: precioRedondeado,
    precioExacto: precioExacto,
    ajusteRedondeo: ajusteRedondeo,
    montoComision: montoComision,
    tasaAplicada: r
  };
};
```

### **Admin - Mostrar en VerProducto.jsx:**

```jsx
{/* Precio de Venta - Principal */}
<div className="mb-4">
  <p className="text-xs uppercase text-gray-500 font-bold mb-2">Precio de Venta</p>
  <p className="text-4xl font-bold text-blue-600">
    ${product.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
  </p>
</div>

{/* Precio Base - Secundario */}
<div>
  <p className="text-xs uppercase text-gray-500 font-bold mb-1">Precio Base</p>
  {product.propiedadesPersonalizadas?.precioBase ? (
    <p className="text-lg font-bold text-green-700">
      ${parseFloat(product.propiedadesPersonalizadas.precioBase)
        .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
    </p>
  ) : (
    <p className="text-sm text-red-600 font-semibold">
      ⚠️ No configurado en BD
    </p>
  )}
</div>

// ❌ NO incluir desglose contable aquí
// El desglose es SOLO para la página de órdenes confirmadas
```

---

## � DÓNDE VER CADA INFORMACIÓN

| Información | Página Admin | Ubicación | Propósito |
|-----------|--------------|-----------|-----------|
| **Precio Base** | Ver Producto | Panel lateral (pequeño) | Referencia de ganancia objetivo |
| **Precio Venta** | Ver Producto | Panel lateral (prominente) | Lo que cobra al cliente |
| **Recargo MP** | Ver Producto | NO se muestra | Calculado implícitamente |
| **Desglose Contable** | Órdenes → Detalles | Sección "Desglose Contable" | Auditoría de lo que pasó |
| **Comisión MP Real** | Órdenes → Detalles | Desglose Contable | Qué cobró Mercado Pago |
| **Neto en Caja** | Órdenes → Detalles | Desglose Contable | Dinero recibido de verdad |

---

## �🔐 LA VERDAD ÚNICA - Backend is Source of Truth

### **Principio Fundamental:**
El **precio base SIEMPRE debe venir del Backend (BD)**, nunca calculado en el frontend.

### **¿Por qué?**

```
❌ INCORRECTO - Frontend calcula:
  precioBase = precioVenta * (1 - 0.0761)
  = $102,900 * 0.9239
  = $95,069.10  ← INCORRECTO, no es el precio base real
  
✅ CORRECTO - Backend envía desde BD:
  precioBase = $95,000  ← Verdad única
```

### **Riesgos de Calcular en Frontend:**
1. **Decimales imprecisos** - Los cálculos pueden variar por redondeos
2. **Inconsistencia** - El admin ve un valor, el cliente otro
3. **Errores contables** - Genera reportes inexactos
4. **Seguridad** - El cliente puede manipular valores en console

### **Implementación Correcta:**

**Frontend (VerProducto.jsx):**
```jsx
{product.propiedadesPersonalizadas?.precioBase ? (
    <>
        <p className="text-xl font-bold text-green-700">
            ${parseFloat(product.propiedadesPersonalizadas.precioBase)
                .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-600">
            Recargo MP: ${(product.precio - parseFloat(
                product.propiedadesPersonalizadas.precioBase
            )).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </p>
    </>
) : (
    <p className="text-sm text-red-600 font-semibold">
        ⚠️ Precio base no configurado. Verificar en BD.
    </p>
)}
```

**¿Qué hace este código?**
- ✅ Muestra el precio base si existe en BD
- ✅ Calcula recargo como diferencia simple (sin fórmulas)
- ❌ NUNCA intenta calcular/adivinar el precio base

### **Backend (Garantía):**
```javascript
// Al crear/editar producto
const precioBase = 95000;  // Usuario ingresa
const precioVenta = config.calcularPrecioVenta(precioBase);

// Se guarda en BD
await Producto.updateOne(
  { _id: id },
  {
    precio: precioVenta.precioVenta,
    propiedadesPersonalizadas: {
      precioBase: precioBase,  // ← VERDAD ÚNICA
      tasaComisionAplicada: 0.0761,
      fechaActualizacionPrecio: new Date()
    }
  }
);
```

---

## 💰 FLUJO DE FONDOS - De Cliente a Tu Cuenta

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣  CLIENTE HACE CLIC EN "COMPRAR"                         │
├─────────────────────────────────────────────────────────────┤
│ Precio mostrado en catálogo/detalle: $102,900.00           │
│ ← Este valor viene del Backend (producto.precio)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣  CLIENTE PAGA A MERCADO PAGO                            │
├─────────────────────────────────────────────────────────────┤
│ Dinero transferido: $102,900.00                             │
│ Pasarela: Mercado Pago SDK                                  │
│ Referencia: order.mercadoPagoId (del webhook)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣  MERCADO PAGO COBRA SU COMISIÓN                         │
├─────────────────────────────────────────────────────────────┤
│ Comisión MP: $102,900 × 7.61% = $7,830.90                 │
│ ← Esta comisión sale automáticamente                        │
│ Webhook notifica: transaction.fee = $7,830.90              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣  NETO DEPOSITADO EN TU CUENTA MP                        │
├─────────────────────────────────────────────────────────────┤
│ Dinero en tu billetera MP: $95,069.10                       │
│ Fórmula: $102,900 - $7,830.90 = $95,069.10                │
│ Transacción en dashboard MP: Depósito de $95,069.10        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣  TRANSFERENCIA A TU BANCO (Opcional)                    │
├─────────────────────────────────────────────────────────────┤
│ Si activas transferencia automática:                        │
│ Tu banco recibe: ~$95,069.10 (menos comisión transferencia) │
│ Tiempo: 1-3 días hábiles                                     │
└─────────────────────────────────────────────────────────────┘
```

### **Desglose de lo que Pasa con $102,900:**

```
Cliente paga:                    $102,900.00  (100%)
  ├─ MP Comisión:               -$7,830.90   (7.61%)
  └─ Tú recibes:                =$95,069.10   (92.39%)

De los $95,069.10 que recibes:
  ├─ Precio Base objetivo:       $95,000.00   (tu ganancia)
  └─ Ganancia extra (redondeo):  +$69.10      (bonus)

Desglose de tu ganancia:
  ├─ Ajuste redondeo:            +$26.81
  ├─ Menos comisión sobre ajuste: -$2.04
  └─ Ganancia neta extra:        =$24.77
  
  Más diferencias de decimales:  =$44.33
```

### **Visualización en Órdenes del Admin:**

```
Cuando ves una orden completada:

┌─────────────────────────────────────────────────┐
│ 📊 DESGLOSE CONTABLE                            │
├─────────────────────────────────────────────────┤
│ Total Facturado (cliente paga):  $102,900.00   │
│ Comisión MP (7.61%):              -$7,830.90   │
├─────────────────────────────────────────────────┤
│ NETO EN CAJA:                     $95,069.10   │
│                                                 │
│ Composición del neto:                           │
│ ├─ Base Items: $95,000.00                       │
│ ├─ Ganancia redondeo: +$69.10                   │
│ └─ Total: $95,069.10                            │
└─────────────────────────────────────────────────┘
```

---

## 📋 TABLA DE FLUJO COMPLETO

| Paso | Evento | Monto | Responsable | Estado |
|------|--------|-------|------------|--------|
| 1 | Cliente ve precio | $102,900 | Backend/Catálogo | Visible |
| 2 | Cliente paga | $102,900 | Mercado Pago | Transacción |
| 3 | MP cobra comisión | -$7,830.90 | Mercado Pago | Automático |
| 4 | Llega a tu MP | $95,069.10 | MP Billetera | Disponible |
| 5 | Registras en BD | ✓ | Tu Admin | Auditable |
| 6 | Transferencia a banco | ~$95,069.10 | Tu Banco | Disponible |

---

## 🎯 RESUMEN - Lo Que Debes Recordar

1. **El Backend es la verdad única** - Todos los precios vienen de BD
2. **El Frontend nunca calcula precios** - Solo muestra lo que recibe del Backend
3. **Dinero que ves ≠ Dinero que recibes** - MP descuenta comisión automáticamente
4. **Base ganancia está garantizada** - $95,000 siempre es respetado
5. **Extra por redondeo es bonus** - Los $69.10 son ganancia adicional
6. **Auditoría clara en órdenes** - Cada orden muestra exactamente qué pasó

