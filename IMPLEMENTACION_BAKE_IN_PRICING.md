# 🚀 Implementación: Sistema de Comisiones Bake-In (Precio Inflado)

**Fecha:** 20 de enero de 2026  
**Estrategia:** Productos guardan precio ya inflado (incluye comisión MP)

---

## 📋 Resumen de la Solución

### Problema Original
- Mercado Pago cobra 7.61% de comisión en tarjetas de crédito
- Comisión no estaba incluida en precios → pérdida de dinero
- Mostrardinámica recargo de 7.61% en checkout generaba fricción psicológica

### Solución Implementada
1. **Pricing Dual en Base de Datos:**
   - `precioBase`: Lo que el negocio necesita recibir (sin comisión)
   - `precio` (precioVenta): Lo que ve el cliente (ya incluye comisión)
   
2. **Fórmula Matemática:**
   ```
   PrecioVenta = PrecioBase / (1 - TasaComisión)
   
   Ejemplo:
   PrecioBase = $1000
   TasaComisión = 7.61% (0.0761)
   PrecioVenta = 1000 / (1 - 0.0761) = 1000 / 0.9239 = $1082.36
   ```

3. **Configuración Centralizada:**
   - Admin puede actualizar tasa global desde panel
   - Al cambiar tasa: recalcula TODOS los productos automáticamente
   - Historial de cambios para auditoría

---

## ✅ Lo que se Implementó

### Backend (gaddyel-backend)

#### 1. Modelo: PaymentConfig
**Archivo:** `src/models/PaymentConfig.js`

- Almacena configuración global de comisiones
- Singleton pattern (un solo documento)
- Campos:
  - `tasaComision`: Tasa porcentual (ej: 0.0761)
  - `comisionFija`: Comisión fija en ARS (generalmente 0 para MP)
  - `estrategia`: 'bake_in' o 'dynamic'
  - `historial`: Últimos 10 cambios

- Métodos:
  - `obtenerConfigActual()`: Obtiene o crea configuración por defecto
  - `calcularPrecioVenta(precioBase)`: Aplica fórmula
  - `calcularPrecioBase(precioVenta)`: Fórmula inversa

#### 2. Modelo Product (Extendido)
**Archivo:** `src/models/Product.js`

- **Nuevo campo:** `precioBase` (required)
- **Campo existente:** `precio` (ahora representa precioVenta)
- **Nuevo campo:** `tasaComisionAplicada` (tasa usada en último cálculo)
- **Nuevo campo:** `fechaActualizacionPrecio`

#### 3. Controller: PaymentConfig
**Archivo:** `src/controllers/paymentConfigController.js`

**Endpoints:**
- `GET /api/payment-config` - Obtener configuración actual
- `PUT /api/payment-config` - Actualizar tasa y recalcular productos
- `GET /api/payment-config/historial` - Ver historial
- `POST /api/payment-config/preview` - Calcular preview sin guardar

**Flujo de actualización:**
1. Validar nueva tasa (0% - 25%)
2. Obtener configuración actual
3. Recorrer TODOS los productos
4. Para cada producto: `nuevoPrecio = calcularPrecioVenta(precioBase)`
5. Guardar producto actualizado
6. Registrar en historial
7. Retornar resumen

#### 4. Rutas
**Archivo:** `src/routes/paymentConfig.js`

- Todas las rutas protegidas con `authenticateToken`
- Solo accesible para admins

#### 5. Registro en index.js
**Archivo:** `src/index.js`

- Importado y registrado: `app.use("/api/payment-config", paymentConfigRoutes)`

---

### Admin (gaddyel-admin)

#### 1. Servicio API
**Archivo:** `src/api/paymentConfigService.js`

- `obtenerConfiguracion()`
- `actualizarConfiguracion(data)`
- `obtenerHistorial()`
- `calcularPreview(data)`

#### 2. Hook Reutilizable
**Archivo:** `src/hooks/usePricing.js`

**Propósito:** Centralizar lógica de pricing en formularios

**Expone:**
- `config`: Configuración actual
- `tasaComision`: Tasa actual (ej: 0.0761)
- `calcularPrecioVenta(base)`: Función de cálculo
- `calcularPrecioBase(venta)`: Función inversa
- `loading`: Estado de carga
- `refetch()`: Recargar configuración

**Uso:**
```jsx
const { calcularPrecioVenta, tasaComision } = usePricing();

// Al cambiar precio base
const handlePrecioBaseChange = (valor) => {
  setPrecioBase(valor);
  const venta = calcularPrecioVenta(valor);
  setPrecioVenta(venta);
};
```

#### 3. Página de Configuración
**Archivo:** `src/pages/ConfiguracionComisiones.jsx`

**Características:**
- Ver configuración actual
- Formulario para nueva tasa
- Botón "Calcular Preview" (muestra ejemplos sin guardar)
- Botón "Guardar y Recalcular Productos" (actualiza todo)
- Tabla de historial de cambios
- Confirmación si hay muchos productos

**UX:**
- Loading states
- Mensajes de feedback (success/error)
- Preview con 3 ejemplos ($1000, $5000, $10000)

#### 4. Router
**Archivo:** `src/router/AdminRouter.jsx`

- Nueva ruta: `/configuracion/comisiones`

---

## ⏳ Pendiente de Implementar

### 1. Modificar ProductCreate.jsx
**Lo que falta:**
- Agregar campo `precioBase` al formulario
- Calcular automáticamente `precio` (precioVenta) usando `usePricing()`
- Mostrar ambos precios con explicación
- Al guardar: enviar `precioBase` y `precio` al backend

**Ejemplo de implementación:**
```jsx
import usePricing from '../../hooks/usePricing';

function ProductCreate() {
  const { calcularPrecioVenta, tasaComision } = usePricing();
  const [precioBase, setPrecioBase] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');

  const handlePrecioBaseChange = (e) => {
    const valor = parseFloat(e.target.value) || 0;
    setPrecioBase(valor);
    
    if (valor > 0) {
      const venta = calcularPrecioVenta(valor);
      setPrecioVenta(venta);
    }
  };

  return (
    <div>
      <label>Precio Base (lo que recibes):</label>
      <input type="number" value={precioBase} onChange={handlePrecioBaseChange} />
      
      <label>Precio de Venta (lo que ve el cliente):</label>
      <input type="number" value={precioVenta} disabled />
      
      <small>Tasa aplicada: {(tasaComision * 100).toFixed(2)}%</small>
    </div>
  );
}
```

### 2. Modificar ProductEdit.jsx
- Igual que ProductCreate pero cargar valores existentes
- Permitir editar `precioBase` → recalcular `precio`

### 3. Eliminar Lógica Dinámica del Frontend
**Archivo:** `Pagina-Gaddyel/src/Paginas/Checkout/OrderSummary.jsx`

**Eliminar:**
- Cálculo dinámico de recargo
- Línea "Recargo Mercado Pago"
- Variables de entorno `VITE_MP_FEE_*`

**Resultado esperado:**
- OrderSummary muestra solo precio final del producto
- No hay línea de recargo adicional
- Cliente ve precio limpio

### 4. Simplificar orderController.js
**Archivo:** `gaddyel-backend/src/controllers/orderController.js`

**Eliminar:**
- Import de `paymentFees.js`
- Lógica de `computeSurchargeForNetTarget()`
- Campo `ajustesPago` en Order

**Resultado:**
- Controller solo usa `producto.precio` (que ya está inflado)
- No aplica cálculos adicionales
- Simplificar código

### 5. Migración de Datos
**CRÍTICO:** Productos existentes no tienen `precioBase`

**Opciones:**
a) Script de migración:
   - Asumir precio actual = precioVenta
   - Calcular precioBase = precio * (1 - 0.0761)
   - Guardar ambos campos

b) Crear endpoint `/api/admin/productos/migrate-pricing`
   - Ejecutar una sola vez
   - Log de productos migrados

**Ejemplo script:**
```javascript
// scripts/migratePricing.js
import { Producto } from '../models/Product.js';
import PaymentConfig from '../models/PaymentConfig.js';

async function migrate() {
  const config = await PaymentConfig.obtenerConfigActual();
  const productos = await Producto.find({});
  
  for (const producto of productos) {
    if (!producto.precioBase) {
      // Asumir precio actual = precioVenta
      producto.precioBase = config.calcularPrecioBase(producto.precio);
      producto.tasaComisionAplicada = config.tasaComision;
      await producto.save();
    }
  }
  
  console.log(`✅ ${productos.length} productos migrados`);
}
```

---

## 🔄 Flujo Completo

### Crear Producto
1. Admin abre `/productos/crear`
2. Llena formulario, ingresa `precioBase = 1000`
3. Hook `usePricing` calcula automáticamente `precioVenta = 1082.36`
4. Admin ve ambos precios en el form
5. Click "Guardar"
6. Backend guarda: `{ precioBase: 1000, precio: 1082.36, tasaComisionAplicada: 0.0761 }`

### Cliente ve Producto
1. Cliente abre catálogo
2. ProductCard muestra `producto.precio` ($1082.36)
3. Cliente agrega al carrito
4. Checkout muestra `subtotal = 1082.36`
5. **NO HAY recargo adicional** (ya está incluido)
6. Mercado Pago procesa $1082.36
7. Negocio recibe: $1082.36 - 7.61% = $1000 ✅

### Actualizar Tasa Global
1. Admin va a `/configuracion/comisiones`
2. Ve tasa actual: 7.61%
3. Mercado Pago sube comisiones a 8%
4. Admin ingresa nueva tasa: 8.00%
5. Click "Calcular Preview" → ve ejemplos
6. Click "Guardar y Recalcular Productos"
7. Backend:
   - Actualiza `config.tasaComision = 0.08`
   - Recorre 250 productos
   - Para cada uno: `precio = precioBase / (1 - 0.08)`
   - Guarda todos
8. Frontend: muestra "✅ 250 productos recalculados"
9. Historial registra: `7.61% → 8.00%`

---

## 🎯 Ventajas de Esta Solución

### 1. Escalabilidad
- Cambiar tasa = 1 click
- Actualización masiva automática
- No requiere redeploy

### 2. Transparencia
- Cliente ve precio final desde el inicio
- No hay "sorpresas" en checkout
- UX limpia y profesional

### 3. Psicología de Precios
- No usar palabra "recargo"
- Precio único = más claro
- Opcional: "Descuento por transferencia" (marketing)

### 4. Contabilidad
- Precio base siempre visible en admin
- Tasa aplicada guardada en cada producto
- Historial auditable

### 5. Mantenibilidad
- Lógica centralizada en `PaymentConfig`
- Hook reutilizable en formularios
- Código más simple (sin cálculos dinámicos)

---

## 📊 Comparación: Solución Anterior vs Nueva

| Aspecto | Anterior (Dynamic) | Nueva (Bake-In) |
|---------|-------------------|-----------------|
| **Precio en DB** | Solo precio base | precioBase + precioVenta |
| **Cálculo** | En cada checkout | Una vez al crear/actualizar |
| **Checkout** | Muestra recargo | Precio final limpio |
| **UX** | "Recargo MP 7.61%" visible | Sin mención de comisión |
| **Escalabilidad** | Cambiar env vars en 2 repos | 1 click en admin |
| **Mantenimiento** | Lógica en 3 lugares | Lógica centralizada |
| **Psicología** | Negativa (recargo) | Neutra (precio final) |

---

## 🚨 Advertencias Importantes

### 1. Migración de Datos
**ANTES de deployar:** ejecutar script de migración en producción.

Productos sin `precioBase` causarán errores:
```
Error: Producto validation failed: precioBase: Path `precioBase` is required.
```

### 2. Comisiones Variables por Método
- Tasa actual (7.61%) es para tarjetas de crédito
- Débito/Cuenta = 2.99%
- Usar tasa más alta = "worst case scenario"
- Alternativa: detectar método en webhook y ajustar (complejidad++)

### 3. Sincronización Admin-Frontend
- Frontend debe usar siempre `producto.precio` (no `precioBase`)
- Admin muestra ambos campos
- API pública solo expone `precio`

### 4. Redondeo
- Fórmula puede generar decimales largos (1082.361...)
- Redondear siempre a 2 decimales
- Mercado Pago rechaza más de 2 decimales

---

## 📝 Próximos Pasos (Orden Recomendado)

1. ✅ **Migrar datos de productos existentes**
   - Script: calcular `precioBase` para productos actuales
   - Validar que todos tengan ambos campos

2. ✅ **Modificar formularios de productos (Admin)**
   - ProductCreate: agregar campo precioBase + cálculo automático
   - ProductEdit: igual que Create

3. ✅ **Eliminar lógica dinámica (Frontend)**
   - OrderSummary: quitar recargo
   - Simplificar checkout

4. ✅ **Limpiar código obsoleto (Backend)**
   - orderController: eliminar computeSurcharge
   - Eliminar paymentFees.js (reemplazado por PaymentConfig)

5. ✅ **Testing**
   - Crear producto con precioBase = 1000
   - Verificar precio = 1082.36
   - Checkout: verificar precio final
   - MP: verificar negocio recibe $1000

6. ✅ **Actualizar documentación**
   - README con nueva arquitectura
   - Guía de uso para admin

7. ✅ **Deploy**
   - Backend: con modelo PaymentConfig
   - Admin: con página de configuración
   - Frontend: sin recargo dinámico

---

## 🔍 Debugging Tips

### Si productos no se crean:
```javascript
// Verificar que formData incluya precioBase
console.log('FormData antes de enviar:', formData);
// Debe tener: { precioBase: 1000, precio: 1082.36, ... }
```

### Si recálculo masivo falla:
```javascript
// En paymentConfigController.js, agregar logs:
console.log(`Recalculando producto ${producto._id}`);
console.log(`  precioBase: ${producto.precioBase}`);
console.log(`  precio anterior: ${producto.precio}`);
console.log(`  precio nuevo: ${nuevoPrecioVenta}`);
```

### Si hook usePricing no carga:
```javascript
// Verificar API call:
const { loading, error, config } = usePricing();
console.log('Config:', config);
console.log('Error:', error);
```

---

## 📚 Documentación Relacionada

- **Formula Source:** Markup inverso para netear comisiones
- **Mercado Pago:** Comisiones por método de pago (Argentina)
- **OWASP 2025:** Validación de inputs en configuración
- **MongoDB Indexes:** precioBase indexado para queries

---

## ✅ Checklist Final

```
[ ] Modelo PaymentConfig creado ✅
[ ] Modelo Product extendido con precioBase ✅
[ ] Controller paymentConfigController implementado ✅
[ ] Rutas registradas en backend ✅
[ ] Servicio paymentConfigService (admin) ✅
[ ] Hook usePricing creado ✅
[ ] Página ConfiguracionComisiones implementada ✅
[ ] Ruta registrada en AdminRouter ✅
[ ] ProductCreate modificado (PENDIENTE)
[ ] ProductEdit modificado (PENDIENTE)
[ ] OrderSummary limpiado (PENDIENTE)
[ ] orderController simplificado (PENDIENTE)
[ ] Script de migración de datos (PENDIENTE)
[ ] Testing completo (PENDIENTE)
[ ] Documentación actualizada (PENDIENTE)
[ ] Deploy a producción (PENDIENTE)
```

---

**Última actualización:** 20 de enero de 2026  
**Estado:** Implementación 70% completa  
**Próximo paso:** Modificar ProductCreate.jsx y ProductEdit.jsx
