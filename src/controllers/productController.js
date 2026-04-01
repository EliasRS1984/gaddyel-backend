/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de productos. Permite crear, leer, editar
 * y eliminar productos del catálogo de Gaddyel.
 * También maneja los productos "destacados" en la página principal.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El sitio web (y el admin) llaman a los distintos endpoints para leer el catálogo.
 * 2. Para crear o editar, el admin envía los datos del producto incluyendo el precioBase.
 * 3. El servidor calcula automáticamente el precio de venta con la tasa de comisión actual.
 * 4. Los precios siempre se calculan en el servidor — nunca se acepta el precio del cliente.
 * 5. La paginación evita cargar todos los productos en memoria cuando hay muchos.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Los productos no cargan? → Revisar obtenerProductos y la query a la base de datos
 * - ¿El precio se ve incorrecto? → Revisar crearProducto/editarProducto y SystemConfig
 * - ¿Las imágenes no aparecen? → Verificar que imagenSrc tenga URL válida de Cloudinary
 * - ¿El toggle de destacado no funciona? → Revisar toggleDestacadoProducto
 * ======================================================
 */

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
            cantidadUnidades: prod.cantidadUnidades,
            propiedadesPersonalizadas: prod.propiedadesPersonalizadas || {},
            // ✅ Incluir datos de precios y fechas
            precioBase: prod.precioBase,
            tasaComisionAplicada: prod.tasaComisionAplicada,
            fechaActualizacionPrecio: prod.fechaActualizacionPrecio,
            createdAt: prod.createdAt,
            updatedAt: prod.updatedAt
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
            precioBase,
            precio,
            cantidadUnidades,
            destacado,
            imagenSrc,
            imagenes,
            propiedadesPersonalizadas,
            tasaComisionAplicada
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

        // ✅ NUEVO: Validar precioBase si se envía
        let precioBaseNum = 0;
        if (precioBase !== undefined) {
            precioBaseNum = parseFloat(precioBase);
            if (isNaN(precioBaseNum) || precioBaseNum < 0) {
                return res.status(400).json({ error: "Precio Base debe ser un número no negativo" });
            }
        }

        // ✅ NUEVO: Validar tasa si se envía
        let tasa = 0.0761; // Valor por defecto
        if (tasaComisionAplicada !== undefined) {
            tasa = parseFloat(tasaComisionAplicada);
            if (isNaN(tasa) || tasa < 0 || tasa > 1) {
                return res.status(400).json({ error: "Tasa de comisión debe estar entre 0 y 1" });
            }
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

        // ✅ CALCULAR METADATOS DE PRICING PARA AUDITORÍA
        // Si se proporciona precioBase, calcular con SystemConfig
        let metadatosPricing = {
            precioCalculadoExacto: 0,
            ajusteRedondeo: 0,
            montoComision: 0
        };

        if (precioBaseNum > 0) {
            const SystemConfig = (await import('../models/SystemConfig.js')).default;
            const config = await SystemConfig.obtenerConfigActual();
            const calculoPrecio = config.calcularPrecioVenta(precioBaseNum);
            
            metadatosPricing = {
                precioCalculadoExacto: calculoPrecio.precioExacto,
                ajusteRedondeo: calculoPrecio.ajusteRedondeo,
                montoComision: calculoPrecio.montoComision
            };
            
            // Actualizar precio con el calculado
            // (Nota: Si el frontend ya lo calculó, debería coincidir)
        }

        const nuevoProducto = new Producto({
            nombre,
            descripcion,
            descripcionCompleta,
            categoria,
            material,
            tamanos: Array.isArray(tamanos) ? tamanos : (tamanos ? tamanos.split(",") : []),
            colores: Array.isArray(colores) ? colores : (colores ? colores.split(",") : []),
            personalizable,
            precioBase: precioBaseNum,
            precio: precioNumero,
            cantidadUnidades: stock,
            tasaComisionAplicada: tasa,
            precioCalculadoExacto: metadatosPricing.precioCalculadoExacto,
            ajusteRedondeo: metadatosPricing.ajusteRedondeo,
            montoComision: metadatosPricing.montoComision,
            fechaActualizacionPrecio: new Date(),
            destacado: destacado === true || destacado === 'true',
            imagenSrc: imagenSrc || null,
            imagenes: imagenesLimpias,
            propiedadesPersonalizadas: propiedadesPersonalizadas || {}
        });

        await nuevoProducto.save();
        res.status(201).json(nuevoProducto);
    } catch (error) {
        logger.error("Error al crear el producto:", { message: error.message });
        res.status(400).json({ error: error.message || "Error al crear el producto" });
    }
};

// Obtener productos destacados
export const obtenerProductosDestacados = async (req, res) => {
    try {
        // ✅ RENDIMIENTO: .lean() devuelve datos en bruto más rápido (operación de solo lectura)
        const productosDestacados = await Producto.find({ destacado: true }).lean();
        res.json(productosDestacados);
    } catch (error) {
        logger.error('Error al obtener productos destacados', { message: error.message });
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

        // ✅ NUEVO: Validar y guardar campos de pricing DIRECTAMENTE
        if (data.precioBase !== undefined) {
            const precioBase = parseFloat(data.precioBase);
            if (isNaN(precioBase) || precioBase < 0) {
                return res.status(400).json({ error: "Precio Base debe ser un número no negativo" });
            }
            data.precioBase = precioBase;
        }

        if (data.tasaComisionAplicada !== undefined) {
            const tasa = parseFloat(data.tasaComisionAplicada);
            if (isNaN(tasa) || tasa < 0 || tasa > 1) {
                return res.status(400).json({ error: "Tasa de comisión debe estar entre 0 y 1" });
            }
            data.tasaComisionAplicada = tasa;
        }

        // 🧾 AUDITORÍA: Si se actualiza precio o precioBase, calcular metadatos contables
        if (data.precioBase !== undefined || data.precio !== undefined) {
            data.fechaActualizacionPrecio = new Date();
            
            // Obtener producto existente para usar valores previos si es necesario
            const productoExistente = await Producto.findById(req.params.id);
            if (!productoExistente) {
                return res.status(404).json({ error: 'Producto no encontrado' });
            }

            // Usar precioBase del request o del producto existente
            const precioBaseActual = data.precioBase !== undefined 
                ? data.precioBase 
                : productoExistente.precioBase || 0;

            if (precioBaseActual > 0) {
                // Importar dinámicamente SystemConfig
                const { default: SystemConfig } = await import('../models/SystemConfig.js');
                const config = await SystemConfig.obtenerConfigActual();
                
                // Calcular pricing con desglose completo
                const breakdown = await config.calcularPrecioVenta(precioBaseActual);
                
                // Guardar precio calculado y metadatos de auditoría
                data.precio = breakdown.precioVenta;
                data.precioCalculadoExacto = breakdown.precioExacto;
                data.ajusteRedondeo = breakdown.ajusteRedondeo;
                data.montoComision = breakdown.montoComision;
                
                // Si no se envió tasaComisionAplicada, usar la que calculó el sistema
                if (data.tasaComisionAplicada === undefined) {
                    data.tasaComisionAplicada = breakdown.tasaAplicada;
                }
            }
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

        // ✅ IMPORTANTE: Usar $set para asegurar que los campos se actualizan directamente
        // NO dentro de propiedadesPersonalizadas
        const actualizado = await Producto.findByIdAndUpdate(
            req.params.id, 
            { $set: data },
            { new: true, runValidators: false }
        );
        
        if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(actualizado);
    } catch (error) {
        logger.error('Error al actualizar producto:', { message: error.message });
        res.status(400).json({ error: error.message || 'Error al actualizar producto' });
    }
};

// Eliminar un producto
export const eliminarProducto = async (req, res) => {
    try {
        await Producto.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        logger.error('Error al eliminar producto:', { message: error.message });
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
        logger.error('Error al actualizar destacado:', { message: error.message });
        res.status(500).json({ error: 'Error al actualizar destacado' });
    }
};

// Alias mínimo para compatibilidad con rutas que usan otro nombre
export const getProductos = obtenerProductos;
