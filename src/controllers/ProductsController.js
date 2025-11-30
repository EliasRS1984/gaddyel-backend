/**
 * Controller: Products
 * Descripción: Manejo del catálogo de productos
 * Propósito: Listar, filtrar, buscar, obtener detalles de productos
 */

const Product = require('../models/Product');
const { logAudit } = require('../utils/logger');

class ProductsController {
  /**
   * GET /api/products
   * Listar productos con filtros y búsqueda
   */
  static async listProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        minPrice,
        maxPrice,
        isFeatured,
        isNewArrival,
        inStock,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Construir filtro
      const filter = { isActive: true };

      if (category) {
        filter.category = category;
      }

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) {
          filter.price.$gte = parseFloat(minPrice);
        }
        if (maxPrice) {
          filter.price.$lte = parseFloat(maxPrice);
        }
      }

      if (isFeatured === 'true') {
        filter.isFeatured = true;
      }

      if (isNewArrival === 'true') {
        filter.isNewArrival = true;
      }

      if (inStock === 'true') {
        filter['stock.available'] = { $gt: 0 };
      }

      // Búsqueda por texto
      if (search) {
        filter.$text = { $search: search };
      }

      // Calcular paginación
      const skip = (page - 1) * limit;

      // Construir sort
      const sortObj = {};
      if (sortBy === 'price') {
        sortObj.price = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'rating') {
        sortObj['rating.average'] = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'sales') {
        sortObj['sales.count'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }

      // Obtener productos
      const products = await Product.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .select('name slug sku price discountPrice discountPercentage category images.main rating.average sales.count stock.available isFeatured isNewArrival')
        .lean();

      // Contar total
      const total = await Product.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logAudit('LIST_PRODUCTS_ERROR', { error: error.message }, 'ERROR');

      res.status(500).json({
        success: false,
        error: 'Error listando productos',
      });
    }
  }

  /**
   * GET /api/products/featured
   * Obtener productos destacados
   */
  static async getFeaturedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.find({
        isActive: true,
        isFeatured: true,
      })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('name slug sku price discountPrice images.main rating.average category');

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo productos destacados',
      });
    }
  }

  /**
   * GET /api/products/new-arrivals
   * Obtener nuevos llegados
   */
  static async getNewArrivals(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.find({
        isActive: true,
        isNewArrival: true,
      })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('name slug sku price discountPrice images.main rating.average category');

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo nuevos llegados',
      });
    }
  }

  /**
   * GET /api/products/:slug
   * Obtener producto por slug
   */
  static async getProductBySlug(req, res) {
    try {
      const { slug } = req.params;

      const product = await Product.findOne({
        slug: slug.toLowerCase(),
        isActive: true,
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Producto no encontrado',
        });
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo producto',
      });
    }
  }

  /**
   * GET /api/products/id/:productId
   * Obtener producto por ID
   */
  static async getProductById(req, res) {
    try {
      const { productId } = req.params;

      const product = await Product.findById(productId);

      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          error: 'Producto no encontrado',
        });
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo producto',
      });
    }
  }

  /**
   * GET /api/products/search
   * Buscar productos por término
   */
  static async searchProducts(req, res) {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'El término de búsqueda debe tener al menos 2 caracteres',
        });
      }

      const products = await Product.find(
        { $text: { $search: q }, isActive: true },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(parseInt(limit))
        .select('name slug sku price discountPrice images.main category rating.average');

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error en búsqueda de productos',
      });
    }
  }

  /**
   * GET /api/products/category/:category
   * Obtener productos por categoría
   */
  static async getProductsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Validar categoría
      const validCategories = ['remeras', 'pantalones', 'chaquetas', 'accesorios', 'calzados', 'otro'];
      if (!validCategories.includes(category.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Categoría inválida. Categorías disponibles: ${validCategories.join(', ')}`,
        });
      }

      const skip = (page - 1) * limit;

      const products = await Product.find({
        category: category.toLowerCase(),
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('name slug sku price discountPrice images.main rating.average stock.available');

      const total = await Product.countDocuments({
        category: category.toLowerCase(),
        isActive: true,
      });

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo productos de categoría',
      });
    }
  }

  /**
   * GET /api/products/availability/:productId
   * Verificar disponibilidad y obtener información de stock
   */
  static async checkProductAvailability(req, res) {
    try {
      const { productId } = req.params;
      const { quantity = 1 } = req.query;

      const product = await Product.findById(productId).select('name sku stock isActive');

      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          error: 'Producto no encontrado',
        });
      }

      const isAvailable = product.isAvailable() && product.stock.available >= parseInt(quantity);

      res.status(200).json({
        success: true,
        data: {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          isAvailable: isAvailable,
          requestedQuantity: parseInt(quantity),
          availableStock: product.stock.available,
          isLowStock: product.isLowStock(),
          message: isAvailable
            ? 'Producto disponible'
            : `Stock insuficiente. Disponibles: ${product.stock.available}`,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error verificando disponibilidad',
      });
    }
  }

  /**
   * GET /api/products/analytics/popular
   * Obtener productos más vendidos
   */
  static async getPopularProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.find({ isActive: true })
        .sort({ 'sales.count': -1 })
        .limit(parseInt(limit))
        .select('name slug sku price images.main sales.count rating.average category');

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo productos populares',
      });
    }
  }

  /**
   * GET /api/products/analytics/low-stock
   * Obtener productos con bajo stock (solo admin)
   */
  static async getLowStockProducts(req, res) {
    try {
      const products = await Product.find({
        $expr: { $lt: ['$stock.available', '$stock.lowStockThreshold'] },
      })
        .sort({ 'stock.available': 1 })
        .select('name sku stock category');

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error obteniendo productos con bajo stock',
      });
    }
  }
}

module.exports = ProductsController;
