/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Lógica de negocio para productos: crear, leer,
 * actualizar, eliminar y validar stock.
 * Los controladores usan estas funciones en lugar de
 * hablar directamente con la base de datos.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Cada método recibe datos validados del controlador.
 * 2. Aplica reglas de negocio (precio > 0, stock >= 0, …).
 * 3. Guarda o consulta en la base de datos y devuelve el resultado.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los productos no se listan? → Revisa getAllProducts().
 * - ¿No se puede crear un producto? → Revisa createProduct()
 *   y las validaciones de precio y stock.
 * - ¿El stock no valida? → Revisa validateStock().
 * ======================================================
 */

import { Producto } from '../models/Product.js';
import logger from '../utils/logger.js';

class ProductService {

    // ======== LISTAR PRODUCTOS CON FILTROS Y PÁGINACIÓN ========
    // Devuelve una página de productos según los filtros recibidos.
    // Usa aggregation de MongoDB para contar y paginar en una sola pasada.
    async getAllProducts(filters = {}) {
        try {
            const {
                page = 1,
                limit = 12,
                categoria,
                destacado,
                personalizable,
                sortBy = 'createdAt',
                sortDir = -1
            } = filters;

            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, parseInt(limit) || 12);
            const skip = (pageNum - 1) * limitNum;

            const pipeline = [];

            const matchStage = {};
            if (categoria) matchStage.categoria = categoria;
            if (destacado !== undefined) matchStage.destacado = destacado === 'true';
            if (personalizable !== undefined) matchStage.personalizable = personalizable === 'true';

            if (Object.keys(matchStage).length > 0) {
                pipeline.push({ $match: matchStage });
            }

            // Solo se permite ordenar por campos seguros.
            // Si llega un campo desconocido, se usa 'createdAt' por defecto.
            const validSortFields = ['precio', 'nombre', 'createdAt', 'destacado', 'categoria'];
            const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

            // Ordenar, paginar y seleccionar campos
            const sortObj = {};
            sortObj[safeSortBy] = parseInt(sortDir) || -1;
            pipeline.push({ $sort: sortObj });

            const countResult = await Producto.aggregate([
                ...pipeline,
                { $count: 'total' }
            ]);
            const total = countResult[0]?.total || 0;
            pipeline.push({ $skip: skip });
            pipeline.push({ $limit: limitNum });
            pipeline.push({
                $project: {
                    nombre: 1,
                    descripcion: 1,
                    imagenSrc: 1,
                    imagenes: 1,
                    destacado: 1,
                    categoria: 1,
                    precio: 1,
                    cantidadUnidades: 1,
                    createdAt: 1
                }
            });

            const productos = await Producto.aggregate(pipeline);

            return {
                data: productos,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(total / limitNum)
                }
            };
        } catch (error) {
            logger.error('Error obteniendo productos', { error: error.message });
            throw error;
        }
    }

    // ======== OBTENER UN PRODUCTO POR ID ========
    async getProductById(id) {
        try {
            const producto = await Producto.findById(id).lean();
            
            if (!producto) {
                const err = new Error('Producto no encontrado');
                err.status = 404;
                throw err;
            }
            
            return producto;
        } catch (error) {
            if (error.status) throw error;
            logger.error('Error obteniendo producto', { id, error: error.message });
            throw error;
        }
    }

    // ======== OBTENER PRODUCTOS DESTACADOS ========
    // Devuelve los productos marcados como destacados, del más reciente al más antiguo.
    async getFeaturedProducts(limit = 6) {
        try {
            const pipeline = [
                { $match: { destacado: true } },
                { $sort: { createdAt: -1 } },
                { $limit: limit },
                {
                    $project: {
                        nombre: 1,
                        descripcion: 1,
                        imagenSrc: 1,
                        imagenes: 1,
                        categoria: 1,
                        precio: 1,
                        cantidadUnidades: 1
                    }
                }
            ];

            const productos = await Producto.aggregate(pipeline);
            return productos;
        } catch (error) {
            logger.error('Error obteniendo productos destacados', { error: error.message });
            throw error;
        }
    }

    // ======== CREAR PRODUCTO ========
    // Valida precio, stock y tamaño de arrays antes de guardar.
    async createProduct(productData) {
        try {
            // Validaciones de lógica de negocio
            if (productData.precio <= 0) {
                const err = new Error('Precio debe ser mayor a 0');
                err.status = 400;
                throw err;
            }

            if (productData.cantidadUnidades < 0) {
                const err = new Error('Stock no puede ser negativo');
                err.status = 400;
                throw err;
            }

            // ✅ Limitar arrays
            if (productData.imagenes?.length > 20) {
                const err = new Error('Máximo 20 imágenes por producto');
                err.status = 400;
                throw err;
            }

            if (productData.tamanos?.length > 15) {
                const err = new Error('Máximo 15 tamaños');
                err.status = 400;
                throw err;
            }

            if (productData.colores?.length > 30) {
                const err = new Error('Máximo 30 colores');
                err.status = 400;
                throw err;
            }

            const producto = new Producto(productData);
            await producto.save();

            logger.info('Producto creado', { id: producto._id, nombre: producto.nombre });
            return producto;
        } catch (error) {
            logger.error('Error creando producto', { error: error.message, data: productData });
            throw error;
        }
    }

    // ======== ACTUALIZAR PRODUCTO ========
    // Solo actualiza los campos permitidos; ignora el resto.
    async updateProduct(id, updateData) {
        try {
            const producto = await Producto.findById(id);
            
            if (!producto) {
                const err = new Error('Producto no encontrado');
                err.status = 404;
                throw err;
            }

            // ✅ Validaciones
            if (updateData.precio !== undefined && updateData.precio <= 0) {
                const err = new Error('Precio debe ser mayor a 0');
                err.status = 400;
                throw err;
            }

            if (updateData.imagenes?.length > 20) {
                const err = new Error('Máximo 20 imágenes por producto');
                err.status = 400;
                throw err;
            }

            // Actualizar solo campos permitidos
            const allowedFields = [
                'nombre', 'descripcion', 'descripcionCompleta', 'precio',
                'categoria', 'material', 'tamanos', 'colores', 'imagenes',
                'cantidadUnidades', 'destacado', 'imagenSrc', 'personalizable'
            ];

            allowedFields.forEach(field => {
                if (field in updateData) {
                    producto[field] = updateData[field];
                }
            });

            await producto.save();

            logger.info('Producto actualizado', { id, nombre: producto.nombre });
            return producto;
        } catch (error) {
            logger.error('Error actualizando producto', { id, error: error.message });
            throw error;
        }
    }

    // ======== ELIMINAR PRODUCTO ========
    async deleteProduct(id) {
        try {
            const producto = await Producto.findByIdAndDelete(id);

            if (!producto) {
                const err = new Error('Producto no encontrado');
                err.status = 404;
                throw err;
            }

            logger.info('Producto eliminado', { id, nombre: producto.nombre });
            return { mensaje: 'Producto eliminado correctamente' };
        } catch (error) {
            logger.error('Error eliminando producto', { id, error: error.message });
            throw error;
        }
    }

    // ======== VALIDAR STOCK ========
    // Verifica que haya suficiente stock antes de crear un pedido.
    async validateStock(productId, requiredQuantity) {
        try {
            const producto = await Producto.findById(productId).lean();
            
            if (!producto) {
                throw new Error(`Producto ${productId} no existe`);
            }

            if (producto.cantidadUnidades < requiredQuantity) {
                const err = new Error(
                    `Stock insuficiente. Disponible: ${producto.cantidadUnidades}, Requerido: ${requiredQuantity}`
                );
                err.status = 400;
                throw err;
            }

            return true;
        } catch (error) {
            logger.error('Error validando stock', { productId, requiredQuantity, error: error.message });
            throw error;
        }
    }

    // ======== TODOS LOS PRODUCTOS SIN PÁGINACIÓN ========
    // Devuelve todos los productos que coinciden con los filtros,
    // sin límite de registros. Usado por el dashboard de estadísticas.
    async getAllProductsNoPagination(filters = {}) {
        try {
            const { categoria, destacado, personalizable } = filters;

            const pipeline = [];

            const matchStage = {};
            if (categoria) matchStage.categoria = categoria;
            if (destacado !== undefined) matchStage.destacado = destacado === 'true';
            if (personalizable !== undefined) matchStage.personalizable = personalizable === 'true';

            if (Object.keys(matchStage).length > 0) {
                pipeline.push({ $match: matchStage });
            }

            pipeline.push({ $sort: { createdAt: -1 } });

            pipeline.push({
                $project: {
                    nombre: 1,
                    descripcion: 1,
                    imagenSrc: 1,
                    imagenes: 1,
                    destacado: 1,
                    categoria: 1,
                    precio: 1,
                    cantidadUnidades: 1,
                    createdAt: 1
                }
            });

            const productos = await Producto.aggregate(pipeline);

            logger.info(`getAllProductsNoPagination: Retornando ${productos.length} productos`);
            return productos;
        } catch (error) {
            logger.error('Error obteniendo productos sin paginación', { error: error.message });
            throw error;
        }
    }
}

export default new ProductService();
