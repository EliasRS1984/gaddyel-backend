/**
 * Validations: Joi Schemas
 * Descripción: Esquemas de validación para solicitudes HTTP
 * Propósito: Validar datos de entrada antes de procesarlos
 */

const Joi = require('joi');

// Esquemas reutilizables
const addressSchema = Joi.object({
  street: Joi.string().min(5).max(100).required(),
  city: Joi.string().min(2).max(50).required(),
  province: Joi.string().min(2).max(50).required(),
  zipCode: Joi.string().pattern(/^\d{4,5}$/).required(),
  country: Joi.string().default('Argentina'),
  isDefault: Joi.boolean().default(false),
  notes: Joi.string().max(200),
});

const customerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  whatsapp: Joi.string().pattern(/^(\+?54)?[\s\-]?9?[\s\-]?\d{2,4}[\s\-]?\d{4}[\s\-]?\d{4}$/).required(),
  cuit: Joi.string().pattern(/^\d{11}$/).optional(),
  dni: Joi.string().pattern(/^\d{7,8}$/).optional(),
  phone: Joi.string().pattern(/^(\+?54)?[\s\-]?\d{2,4}[\s\-]?\d{4}[\s\-]?\d{4}$/).optional(),
});

const cartItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  productName: Joi.string().required(),
  sku: Joi.string().required(),
  quantity: Joi.number().integer().min(1).max(1000).required(),
  price: Joi.number().positive().required(),
  discount: Joi.number().min(0).optional(),
  variations: Joi.object({
    size: Joi.string().optional(),
    color: Joi.string().optional(),
    material: Joi.string().optional(),
  }).optional(),
});

// Validaciones de órdenes
const schemas = {
  /**
   * Validar creación de orden
   */
  createOrder: Joi.object({
    customerData: customerSchema.required(),
    items: Joi.array()
      .items(cartItemSchema)
      .min(1)
      .required(),
    shippingAddress: addressSchema.required(),
    shippingCost: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    idempotencyKey: Joi.string().uuid().optional(),
  }),

  /**
   * Validar items del carrito
   */
  validateCartItems: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().hex().length(24).required(),
          quantity: Joi.number().integer().min(1).required(),
          variations: Joi.object().optional(),
        })
      )
      .min(1)
      .required(),
  }),

  /**
   * Validar datos del cliente
   */
  validateCustomer: customerSchema,

  /**
   * Validar checkout
   */
  initiateCheckout: Joi.object({
    orderId: Joi.string().hex().length(24).required(),
  }),

  /**
   * Validar reembolso
   */
  refundOrder: Joi.object({
    reason: Joi.string().max(500).optional(),
  }),

  /**
   * Validar actualización de estado de orden
   */
  updateOrderStatus: Joi.object({
    status: Joi.string()
      .valid(
        'pending_payment',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'failed'
      )
      .required(),
    notes: Joi.string().max(500).optional(),
  }),

  /**
   * Validar paginación y filtros de lista
   */
  listOrders: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().optional(),
    customerId: Joi.string().hex().length(24).optional(),
    customerEmail: Joi.string().email().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    minTotal: Joi.number().min(0).optional(),
    maxTotal: Joi.number().min(0).optional(),
  }),

  /**
   * Validar filtros de productos
   */
  listProducts: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    category: Joi.string()
      .valid('remeras', 'pantalones', 'chaquetas', 'accesorios', 'calzados', 'otro')
      .optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    isFeatured: Joi.boolean().optional(),
    isNewArrival: Joi.boolean().optional(),
    inStock: Joi.boolean().optional(),
    search: Joi.string().min(2).max(100).optional(),
    sortBy: Joi.string()
      .valid('createdAt', 'price', 'rating', 'sales')
      .optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
  }),

  /**
   * Validar búsqueda de productos
   */
  searchProducts: Joi.object({
    q: Joi.string().min(2).max(100).required(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),

  /**
   * Validar verificación de disponibilidad
   */
  checkAvailability: Joi.object({
    quantity: Joi.number().integer().min(1).optional(),
  }),

  /**
   * Validar webhook de Mercado Pago
   */
  mercadopagoWebhook: Joi.object({
    type: Joi.string()
      .valid('payment', 'plan', 'subscription', 'merchant_order')
      .required(),
    data: Joi.object({
      id: Joi.string().required(),
    }).required(),
  }).unknown(true),
};

/**
 * Middleware para validar solicitud
 * @param {Joi.ObjectSchema} schema - Schema a validar
 * @returns {Function} - Middleware express
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        type: err.type,
      }));

      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details,
      });
    }

    req.validatedBody = value;
    next();
  };
};

/**
 * Middleware para validar query params
 * @param {Joi.ObjectSchema} schema - Schema a validar
 * @returns {Function} - Middleware express
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details,
      });
    }

    req.validatedQuery = value;
    next();
  };
};

/**
 * Middleware para validar params
 * @param {Joi.ObjectSchema} schema - Schema a validar
 * @returns {Function} - Middleware express
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Error de validación de parámetros',
      });
    }

    req.validatedParams = value;
    next();
  };
};

module.exports = {
  schemas,
  validate,
  validateQuery,
  validateParams,
  addressSchema,
  customerSchema,
  cartItemSchema,
};
