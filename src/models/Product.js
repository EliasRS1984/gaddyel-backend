/**
 * Model: Product
 * Descripción: Esquema de producto con stock, precios y metadatos
 * Propósito: Almacenar información de productos disponibles en el catálogo
 */

import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const productSchema = new Schema({
  // Información básica
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [200, 'El nombre no puede exceder 200 caracteres'],
    index: true,
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'El slug solo puede contener letras, números y guiones'],
  },
  
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    minlength: [10, 'La descripción debe tener al menos 10 caracteres'],
    maxlength: [2000, 'La descripción no puede exceder 2000 caracteres'],
  },
  
  shortDescription: {
    type: String,
    maxlength: [500, 'La descripción corta no puede exceder 500 caracteres'],
  },
  
  // Categoría
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: [
      'remeras',
      'pantalones',
      'chaquetas',
      'accesorios',
      'calzados',
      'otro'
    ],
    index: true,
  },
  
  subcategory: String,
  
  // Precios
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo'],
  },
  
  costPrice: {
    type: Number,
    min: [0, 'El precio de costo no puede ser negativo'],
  },
  
  // Descuentos
  discountPrice: {
    type: Number,
    min: [0, 'El precio con descuento no puede ser negativo'],
  },
  
  discountPercentage: {
    type: Number,
    min: [0, 'El descuento no puede ser negativo'],
    max: [100, 'El descuento no puede exceder 100%'],
  },
  
  discountValidUntil: Date,
  
  // Stock
  stock: {
    total: {
      type: Number,
      default: 0,
      min: [0, 'El stock no puede ser negativo'],
    },
    available: {
      type: Number,
      default: 0,
      min: [0, 'El stock disponible no puede ser negativo'],
    },
    reserved: {
      type: Number,
      default: 0,
      min: [0, 'El stock reservado no puede ser negativo'],
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
  },
  
  // SKU (código único)
  sku: {
    type: String,
    unique: true,
    required: [true, 'El SKU es requerido'],
    uppercase: true,
    match: [/^[A-Z0-9\-]+$/, 'El SKU solo puede contener letras mayúsculas, números y guiones'],
  },
  
  // Imágenes
  images: {
    main: {
      type: String,
      required: [true, 'La imagen principal es requerida'],
    },
    gallery: [String],
    thumbnail: String,
  },
  
  // Variaciones (talle, color, etc)
  variations: [{
    name: {
      type: String,
      enum: ['size', 'color', 'material'],
    },
    options: [String],
  }],
  
  // Especificaciones técnicas
  specifications: {
    material: String,
    color: String,
    size: String,
    weight: String,
    dimensions: {
      width: Number,   // cm
      height: Number,  // cm
      depth: Number,   // cm
    },
  },
  
  // Metadatos para SEO
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
  },
  
  // Estado del producto
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  isFeatured: {
    type: Boolean,
    default: false,
  },
  
  isNewArrival: {
    type: Boolean,
    default: false,
  },
  
  // Calificaciones
  rating: {
    average: {
      type: Number,
      min: [0, 'La calificación mínima es 0'],
      max: [5, 'La calificación máxima es 5'],
      default: 0,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  
  // Estadísticas de ventas
  sales: {
    count: {
      type: Number,
      default: 0,
    },
    lastSaleDate: Date,
    revenue: {
      type: Number,
      default: 0,
    },
  },
  
  // URLs relacionadas
  relatedProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product',
  }],
  
  // Etiquetas
  tags: [String],
  
  // Notas internas
  internalNotes: String,
  
  // Auditoría
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  createdBy: {
    type: String,
    default: 'system',
  },
  
  updatedBy: String,
});

// Índices para mejora de performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'sales.count': -1 });

// Middleware: Actualizar updatedAt antes de guardar
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para verificar disponibilidad
productSchema.methods.isAvailable = function() {
  return this.isActive && this.stock.available > 0;
};

// Método para obtener precio actual (con descuento si aplica)
productSchema.methods.getCurrentPrice = function() {
  if (this.discountPrice && new Date() < this.discountValidUntil) {
    return this.discountPrice;
  }
  return this.price;
};

// Método para obtener descuento actual
productSchema.methods.getDiscount = function() {
  const currentPrice = this.getCurrentPrice();
  if (currentPrice < this.price) {
    return {
      percentage: Math.round(((this.price - currentPrice) / this.price) * 100),
      amount: this.price - currentPrice,
    };
  }
  return null;
};

// Método para reservar stock
productSchema.methods.reserveStock = function(quantity) {
  if (this.stock.available < quantity) {
    throw new Error(`Stock insuficiente. Disponible: ${this.stock.available}, Solicitado: ${quantity}`);
  }
  
  this.stock.available -= quantity;
  this.stock.reserved += quantity;
  return this.save();
};

// Método para confirmar venta
productSchema.methods.confirmSale = function(quantity) {
  if (this.stock.reserved < quantity) {
    throw new Error('No hay stock reservado suficiente');
  }
  
  this.stock.total -= quantity;
  this.stock.reserved -= quantity;
  this.sales.count += 1;
  this.sales.lastSaleDate = Date.now();
  this.sales.revenue += (this.getCurrentPrice() * quantity);
  
  return this.save();
};

// Método para liberar stock reservado
productSchema.methods.releaseStock = function(quantity) {
  if (this.stock.reserved < quantity) {
    throw new Error('No hay stock reservado suficiente para liberar');
  }
  
  this.stock.available += quantity;
  this.stock.reserved -= quantity;
  return this.save();
};

// Método para reportar bajo stock
productSchema.methods.isLowStock = function() {
  return this.stock.available <= this.stock.lowStockThreshold;
};

// Método estático para buscar productos activos
productSchema.statics.findActive = function(query = {}) {
  return this.find({ ...query, isActive: true });
};

// Método estático para búsqueda por texto
productSchema.statics.searchByText = function(searchTerm) {
  return this.find({ $text: { $search: searchTerm }, isActive: true });
};

export default mongoose.model('Product', productSchema);
