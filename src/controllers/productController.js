import { Producto } from "../models/Product.js";
import productService from "../services/productService.js";
import logger from "../utils/logger.js";

// Obtener todos los productos
export const obtenerProductos = async (req, res, next) => {
    try {
        // ✅ productService ahora retorna {data, pagination}
        const resultado = await productService.getAllProducts(req.query);

        // Formato coherente con el frontend
        const productosFormateados = resultado.data.map(prod => ({
            _id: prod._id,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            imagenSrc: prod.imagenSrc,
            imagenes: prod.imagenes?.length ? prod.imagenes : [{ src: prod.imagenSrc, alt: prod.nombre }],
            destacado: prod.destacado,
            categoria: prod.categoria,
            precio: prod.precio,
            cantidadUnidades: prod.cantidadUnidades
        }));

        // Respuesta con paginación
        res.json({
            data: productosFormateados,
            pagination: resultado.pagination
        });
    } catch (error) {
        logger.error("Error al obtener los productos:", error.message);
        next(error);
    }
};

/**
 * ✅ NUEVO: Obtener TODOS los productos sin paginación
 * Usado por Dashboard y componentes que necesitan lista completa
 * @route GET /productos/all
 * @access Public
 */
export const obtenerProductosSinPaginacion = async (req, res, next) => {
    try {
        logger.info("🔵 GET /productos/all - Solicitando TODOS los productos sin paginación");
        
        // ✅ Obtener TODOS los productos sin paginación
        const productos = await productService.getAllProductsNoPagination(req.query);

        // Formato coherente con el frontend
        const productosFormateados = productos.map(prod => ({
            _id: prod._id,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            imagenSrc: prod.imagenSrc,
            imagenes: prod.imagenes?.length ? prod.imagenes : [{ src: prod.imagenSrc, alt: prod.nombre }],
            destacado: prod.destacado,
            categoria: prod.categoria,
            precio: prod.precio,
            cantidadUnidades: prod.cantidadUnidades
        }));

        logger.info(`✅ Retornando ${productosFormateados.length} productos sin paginación`);

        // Respuesta SIN paginación
        res.json({
            data: productosFormateados,
            total: productosFormateados.length
        });
    } catch (error) {
        logger.error("Error al obtener productos sin paginación:", error.message);
        next(error);
    }
};

// Obtener un producto por ID
export const obtenerProductoPorId = async (req, res, next) => {
    try {
        // ✅ Usar service
        const prod = await productService.getProductById(req.params.id);

        const productoFormateado = {
            _id: prod._id,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            descripcionCompleta: prod.descripcionCompleta,
            imagenSrc: prod.imagenSrc,
            imagenes: prod.imagenes?.length ? prod.imagenes : [{ src: prod.imagenSrc, alt: prod.nombre }],
            destacado: prod.destacado,
            categoria: prod.categoria,
            material: prod.material,
            tamanos: prod.tamanos,
            colores: prod.colores,
            personalizable: prod.personalizable,
            precio: prod.precio,
            cantidadUnidades: prod.cantidadUnidades
        };

        res.json(productoFormateado);
    } catch (error) {
        // FLUJO: Error handling delegado al middleware de errores
        // Solo un call a next() para evitar ERR_HTTP_HEADERS_SENT
        logger.error("Error al buscar el producto:", error.message);
        next(error);
    }
};

// Crear un nuevo producto con imagen
export const crearProducto = async (req, res) => {
    try {
        const {
            nombre,
            descripcion,
            descripcionCompleta,
            categoria,
            material,
            tamanos,
            colores,
            personalizable,
            precio,
            cantidadUnidades,
            destacado,
            imagenSrc,
            imagenes,
            propiedadesPersonalizadas
        } = req.body;

        // Validación básica
        if (!nombre || !precio) {
            return res.status(400).json({ error: "Nombre y precio son obligatorios" });
        }

        // Validar que precio sea un número válido y positivo
        const precioNumero = parseFloat(precio);
        if (isNaN(precioNumero) || precioNumero <= 0) {
            return res.status(400).json({ error: "Precio debe ser un número positivo" });
        }

        // Validar que cantidadUnidades sea un número válido y no negativo
        const stock = parseInt(cantidadUnidades) || 0;
        if (isNaN(stock) || stock < 0) {
            return res.status(400).json({ error: "Stock debe ser un número no negativo" });
        }

        // Filtrar imagenes para eliminar nulls/undefined
        const imagenesLimpias = (imagenes && Array.isArray(imagenes) && imagenes.length > 0) 
            ? imagenes.filter(img => img) 
            : [];

        const nuevoProducto = new Producto({
            nombre,
            descripcion,
            descripcionCompleta,
            categoria,
            material,
            tamanos: Array.isArray(tamanos) ? tamanos : (tamanos ? tamanos.split(",") : []),
            colores: Array.isArray(colores) ? colores : (colores ? colores.split(",") : []),
            personalizable,
            precio: precioNumero,
            cantidadUnidades: stock,
            destacado: destacado === true || destacado === 'true',
            imagenSrc: imagenSrc || null,
            imagenes: imagenesLimpias,
            propiedadesPersonalizadas: propiedadesPersonalizadas || {}
        });

        await nuevoProducto.save();
        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error("Error al crear el producto:", error);
        res.status(400).json({ error: error.message || "Error al crear el producto" });
    }
};

// Obtener productos destacados
export const obtenerProductosDestacados = async (req, res) => {
    try {
        const productosDestacados = await Producto.find({ destacado: true });
        res.json(productosDestacados);
    } catch (error) {
        console.error("Error al obtener productos destacados:", error);
        res.status(500).json({ error: "Error al obtener productos destacados" });
    }
};

// Editar un producto por id
export const editarProducto = async (req, res) => {
    try {
        let data = req.body;
        
        // Validar precio si se envía
        if (data.precio !== undefined) {
            const precioNumero = parseFloat(data.precio);
            if (isNaN(precioNumero) || precioNumero <= 0) {
                return res.status(400).json({ error: "Precio debe ser un número positivo" });
            }
            data.precio = precioNumero;
        }

        // Validar stock si se envía
        if (data.cantidadUnidades !== undefined) {
            const stock = parseInt(data.cantidadUnidades);
            if (isNaN(stock) || stock < 0) {
                return res.status(400).json({ error: "Stock debe ser un número no negativo" });
            }
            data.cantidadUnidades = stock;
        }

        // Filtrar imagenes para eliminar nulls/undefined
        if (data.imagenes && Array.isArray(data.imagenes)) {
            data.imagenes = data.imagenes.filter(img => img);
        }

        if (req.file) {
            // si se subió una nueva imagen, guardar path como imagenSrc
            data.imagenSrc = req.file.path;
            data.imagenes = data.imagenes || [];
            if (!data.imagenes.length) data.imagenes = [{ src: data.imagenSrc, alt: data.nombre }];
        }

        const actualizado = await Producto.findByIdAndUpdate(req.params.id, data, { new: true });
        if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(actualizado);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(400).json({ error: error.message || 'Error al actualizar producto' });
    }
};

// Eliminar un producto
export const eliminarProducto = async (req, res) => {
    try {
        await Producto.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};

// Toggle destacado de un producto (PATCH)
export const toggleDestacadoProducto = async (req, res) => {
    try {
        const { destacado } = req.body;
        
        if (typeof destacado !== 'boolean') {
            return res.status(400).json({ error: 'El campo destacado debe ser booleano' });
        }

        const producto = await Producto.findByIdAndUpdate(
            req.params.id,
            { destacado },
            { new: true }
        );

        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(producto);
    } catch (error) {
        console.error('Error al actualizar destacado:', error);
        res.status(500).json({ error: 'Error al actualizar destacado' });
    }
};

// Alias mínimo para compatibilidad con rutas que usan otro nombre
export const getProductos = obtenerProductos;
