# 🎨 Guía de Integración Frontend - React

Cómo integrar el backend de Gaddyel con tu aplicación React.

---

## 📋 Tabla de Contenidos

1. [Setup del Cliente](#setup-del-cliente)
2. [Servicios API](#servicios-api)
3. [Context del Carrito](#context-del-carrito)
4. [Flujo de Checkout](#flujo-de-checkout)
5. [Ejemplos de Componentes](#ejemplos-de-componentes)
6. [Manejo de Errores](#manejo-de-errores)

---

## 🚀 Setup del Cliente

### Instalación de Dependencias

```bash
npm install axios zustand react-router-dom
```

### Variables de Entorno

Crear `.env` en el cliente:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_MP_PUBLIC_KEY=APP_USR-xxxxx-xxxxx # De Mercado Pago
```

### Configurar axios

```javascript
// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token (si usas autenticación)
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Interceptor para manejar errores
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error || 'Error en la solicitud';
    return Promise.reject(new Error(message));
  }
);

export default api;
```

---

## 🔗 Servicios API

### ProductService

```javascript
// src/services/productService.js
import api from './api';

export const productService = {
  // Listar productos
  getProducts: (params = {}) =>
    api.get('/products', { params }),

  // Obtener producto por slug
  getBySlug: (slug) =>
    api.get(`/products/${slug}`),

  // Obtener producto por ID
  getById: (id) =>
    api.get(`/products/id/${id}`),

  // Búsqueda
  search: (query) =>
    api.get('/products/search', { params: { q: query } }),

  // Productos destacados
  getFeatured: (limit = 10) =>
    api.get('/products/featured', { params: { limit } }),

  // Nuevos llegados
  getNewArrivals: (limit = 10) =>
    api.get('/products/new-arrivals', { params: { limit } }),

  // Productos populares
  getPopular: (limit = 10) =>
    api.get('/products/analytics/popular', { params: { limit } }),

  // Verificar disponibilidad
  checkAvailability: (productId, quantity = 1) =>
    api.get(`/products/availability/${productId}`, { params: { quantity } }),
};
```

### OrderService

```javascript
// src/services/orderService.js
import api from './api';

export const orderService = {
  // Crear orden
  create: (orderData) =>
    api.post('/orders', orderData),

  // Obtener órdenes del cliente
  getCustomerOrders: (customerId, page = 1, limit = 10) =>
    api.get(`/customer/${customerId}/orders`, { 
      params: { page, limit } 
    }),

  // Obtener detalles de orden
  getById: (orderId) =>
    api.get(`/orders/${orderId}`),

  // Obtener por número
  getByNumber: (orderNumber) =>
    api.get(`/orders/number/${orderNumber}`),

  // Obtener estado de pago
  getPaymentStatus: (orderId) =>
    api.get(`/orders/${orderId}/status`),

  // Reintentar pago
  retryPayment: (orderId) =>
    api.post(`/orders/${orderId}/retry`),

  // Refundar
  refund: (orderId, reason) =>
    api.post(`/orders/${orderId}/refund`, { reason }),

  // Iniciar checkout
  initiateCheckout: (orderId) =>
    api.post('/checkout', { orderId }),
};
```

---

## 🛒 Context del Carrito

### Zustand Store

```javascript
// src/store/cartStore.js
import create from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      
      // Agregar item
      addItem: (product, quantity = 1, variations = {}) => {
        set(state => {
          const existingItem = state.items.find(
            item => item.productId === product._id && 
                     JSON.stringify(item.variations) === JSON.stringify(variations)
          );

          if (existingItem) {
            return {
              items: state.items.map(item =>
                item === existingItem
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product._id,
                productName: product.name,
                sku: product.sku,
                price: product.discountPrice || product.price,
                discount: product.discountPercentage || 0,
                quantity,
                variations,
                image: product.images?.main,
              },
            ],
          };
        });
      },

      // Actualizar cantidad
      updateQuantity: (productId, quantity, variations = {}) => {
        set(state => ({
          items: state.items.map(item =>
            item.productId === productId &&
            JSON.stringify(item.variations) === JSON.stringify(variations)
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          ).filter(item => item.quantity > 0),
        }));
      },

      // Remover item
      removeItem: (productId, variations = {}) => {
        set(state => ({
          items: state.items.filter(
            item => !(
              item.productId === productId &&
              JSON.stringify(item.variations) === JSON.stringify(variations)
            )
          ),
        }));
      },

      // Limpiar carrito
      clearCart: () => set({ items: [] }),

      // Obtener total
      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + (item.price * item.quantity),
          0
        );
      },

      // Obtener cantidad de items
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'gaddyel-cart',
      getStorage: () => localStorage,
    }
  )
);
```

---

## 🛍️ Flujo de Checkout

### Componente Checkout

```javascript
// src/pages/Checkout.jsx
import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { orderService } from '../services/orderService';
import { useNavigate } from 'react-router-dom';

export function Checkout() {
  const navigate = useNavigate();
  const cartItems = useCartStore(state => state.items);
  const cartTotal = useCartStore(state => state.getTotal());
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    cuit: '',
    street: '',
    city: '',
    province: '',
    zipCode: '',
    shippingCost: 0,
    discount: 0,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'shippingCost' || name === 'discount'
        ? parseFloat(value)
        : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validaciones básicas
      if (cartItems.length === 0) {
        throw new Error('El carrito está vacío');
      }

      // Crear orden
      const response = await orderService.create({
        customerData: {
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          cuit: formData.cuit,
        },
        items: cartItems,
        shippingAddress: {
          street: formData.street,
          city: formData.city,
          province: formData.province,
          zipCode: formData.zipCode,
          isDefault: true,
        },
        shippingCost: formData.shippingCost,
        discount: formData.discount,
        idempotencyKey: crypto.randomUUID(),
      });

      const { order, checkout } = response;

      // Guardar orden en sessionStorage
      sessionStorage.setItem('currentOrder', JSON.stringify(order));

      // Redirigir a Mercado Pago
      // En producción usar checkout.checkoutUrl
      // En desarrollo usar checkout.sandboxCheckoutUrl
      window.location.href = process.env.NODE_ENV === 'production'
        ? checkout.checkoutUrl
        : checkout.sandboxCheckoutUrl;

    } catch (err) {
      setError(err.message);
      console.error('Error en checkout:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Sección de Cliente */}
        <section>
          <h2>Datos Personales</h2>

          <input
            type="text"
            name="name"
            placeholder="Nombre completo"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="tel"
            name="whatsapp"
            placeholder="WhatsApp (+54 9 ...)"
            value={formData.whatsapp}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="cuit"
            placeholder="CUIT (opcional)"
            value={formData.cuit}
            onChange={handleChange}
          />
        </section>

        {/* Sección de Dirección */}
        <section>
          <h2>Dirección de Envío</h2>

          <input
            type="text"
            name="street"
            placeholder="Calle y número"
            value={formData.street}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="city"
            placeholder="Ciudad"
            value={formData.city}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="province"
            placeholder="Provincia"
            value={formData.province}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="zipCode"
            placeholder="Código postal"
            value={formData.zipCode}
            onChange={handleChange}
            required
          />
        </section>

        {/* Resumen de Orden */}
        <section className="order-summary">
          <h2>Resumen de Orden</h2>

          {cartItems.map(item => (
            <div key={item.productId} className="order-item">
              <span>{item.productName}</span>
              <span>x{item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          <div className="order-total">
            <div className="subtotal">
              Subtotal: $
              {(cartTotal - formData.discount + formData.shippingCost).toFixed(2)}
            </div>
            <div className="shipping">
              Envío: ${formData.shippingCost.toFixed(2)}
            </div>
            <div className="discount">
              Descuento: -${formData.discount.toFixed(2)}
            </div>
            <div className="total">
              Total: ${cartTotal.toFixed(2)}
            </div>
          </div>
        </section>

        {/* Botón Submit */}
        <button
          type="submit"
          disabled={loading || cartItems.length === 0}
          className="btn-primary btn-large"
        >
          {loading ? 'Procesando...' : 'Ir al Pago'}
        </button>
      </form>
    </div>
  );
}
```

---

## ✅ Página de Confirmación

### Success Page

```javascript
// src/pages/CheckoutSuccess.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { orderService } from '../services/orderService';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId) {
      navigate('/');
      return;
    }

    // Obtener estado de la orden
    orderService
      .getById(orderId)
      .then(setOrder)
      .catch(err => console.error('Error:', err))
      .finally(() => setLoading(false));
  }, [searchParams, navigate]);

  if (loading) return <div>Cargando...</div>;
  if (!order) return <div>Orden no encontrada</div>;

  return (
    <div className="success-page">
      <h1>¡Pago Exitoso! ✅</h1>

      <div className="success-message">
        <p>Gracias por tu compra</p>
        <p>Hemos enviado un email de confirmación a {order.customerSnapshot?.email}</p>
      </div>

      <div className="order-details">
        <h2>Número de Orden: #{order.orderNumber}</h2>

        <div className="order-info">
          <p><strong>Estado:</strong> {order.status}</p>
          <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
          <p><strong>Fecha:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>

        <div className="order-items">
          <h3>Productos</h3>
          {order.items?.map((item, i) => (
            <div key={i} className="item">
              <span>{item.productName}</span>
              <span>x{item.quantity}</span>
              <span>${item.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => navigate('/')}>
        Volver al Inicio
      </button>
    </div>
  );
}
```

### Failure Page

```javascript
// src/pages/CheckoutFailure.jsx
import { useSearchParams, useNavigate } from 'react-router-dom';
import { orderService } from '../services/orderService';

export function CheckoutFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const handleRetry = async () => {
    try {
      await orderService.retryPayment(orderId);
      navigate(`/checkout/success?order_id=${orderId}`);
    } catch (err) {
      console.error('Error retrying:', err);
    }
  };

  return (
    <div className="failure-page">
      <h1>Pago No Completado ❌</h1>

      <div className="failure-message">
        <p>Lo sentimos, tu pago no pudo ser procesado.</p>
        <p>Por favor intenta nuevamente o contacta a soporte.</p>
      </div>

      <button onClick={handleRetry} className="btn-primary">
        Reintentar Pago
      </button>

      <button onClick={() => navigate('/')} className="btn-secondary">
        Volver al Inicio
      </button>
    </div>
  );
}
```

---

## 🚨 Manejo de Errores

```javascript
// src/utils/errorHandler.js
export class APIError extends Error {
  constructor(message, statusCode = 400, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Mapeo de errores
export const getErrorMessage = (error) => {
  if (error.response?.status === 400) {
    return error.response.data?.details?.[0]?.message || 'Datos inválidos';
  }

  if (error.response?.status === 404) {
    return 'Recurso no encontrado';
  }

  if (error.response?.status === 429) {
    return 'Demasiadas solicitudes. Intenta más tarde.';
  }

  if (error.response?.status >= 500) {
    return 'Error del servidor. Intenta más tarde.';
  }

  return error.message || 'Error inesperado';
};
```

---

## 📲 Responsive Design

```css
/* src/styles/checkout.css */

@media (max-width: 768px) {
  .checkout-page {
    padding: 1rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  input {
    width: 100%;
  }

  .order-summary {
    order: -1; /* Mostrar resumen arriba en mobile */
  }
}
```

---

## 🔐 Seguridad en Frontend

```javascript
// ✅ Buenas prácticas

// 1. No guardar datos sensibles
localStorage.removeItem('cardData');
localStorage.removeItem('password');

// 2. Usar HTTPS
const isSecure = window.location.protocol === 'https:';
if (!isSecure && process.env.NODE_ENV === 'production') {
  window.location.href = 'https://' + window.location.host;
}

// 3. Validar en cliente y servidor
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^(\+?54)?[\d\s\-]{9,}$/.test(phone);

// 4. No exponer tokens en URL
// ❌ Mal: /checkout/success?token=abc123
// ✅ Bien: Usar sessionStorage o cookie httpOnly

// 5. Sanitizar entrada de usuario
const sanitize = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};
```

---

## 🧪 Testing

```javascript
// src/__tests__/checkout.test.js
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkout } from '../pages/Checkout';

describe('Checkout', () => {
  it('should submit form with valid data', async () => {
    render(<Checkout />);

    // Llenar formulario
    await userEvent.type(
      screen.getByPlaceholderText('Nombre completo'),
      'Juan Pérez'
    );

    // Enviar
    await userEvent.click(screen.getByText('Ir al Pago'));

    // Validar
    expect(screen.getByText(/procesando/i)).toBeInTheDocument();
  });

  it('should show error for invalid email', async () => {
    render(<Checkout />);

    await userEvent.type(
      screen.getByPlaceholderText('Email'),
      'invalid-email'
    );

    // El formulario debería mostrar error
  });
});
```

---

**Última actualización:** 30 nov 2024
