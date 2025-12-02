const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Información básica
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  
  // Precios
  price: { type: Number, required: true, min: 0 },
  cost: { type: Number, default: 0 },
  
  // Stock y variantes
  stock: { type: Number, required: true, default: 0 },
  sku: { type: String, unique: true, sparse: true },
  
  // Variantes (si existen)
  variants: [
    {
      name: String,
      options: [
        {
          value: String,
          stock: Number,
          priceModifier: { type: Number, default: 0 }
        }
      ]
    }
  ],
  
  // Imágenes
  images: [
    {
      url: String,
      alt: String,
      isPrimary: { type: Boolean, default: false }
    }
  ],
  
  // SEO
  slug: { type: String, unique: true, sparse: true },
  
  // Metadata
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Control de cambios
  metadata: {
    views: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  }
});

// Índices
ProductSchema.index({ slug: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', ProductSchema);
