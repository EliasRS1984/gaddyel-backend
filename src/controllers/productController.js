import Product from "../models/Product.js";

// Obtener todos los productos
export const obtenerProductos = async (req, res) => {
    try {
        const productos = await Product.find();

        // Formato coherente con el frontend
        const productosFormateados = productos.map(prod => ({
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
        }));

        res.json(productosFormateados);
    } catch (error) {
        console.error("Error al obtener los productos:", error);
        res.status(500).json({ error: "Error al obtener los productos" });
    }
};

// Obtener un producto por ID
export const obtenerProductoPorId = async (req, res) => {
    try {
        const prod = await Product.findById(req.params.id);
        if (!prod) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

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
        console.error("Error al buscar el producto:", error);
        res.status(500).json({ error: "Error al buscar el producto" });
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
            destacado
        } = req.body;

        const imagenSrc = req.file ? req.file.path : null;

        const nuevoProducto = new Product({
            nombre,
            descripcion,
            descripcionCompleta,
            categoria,
            material,
            tamanos: tamanos ? tamanos.split(",") : [],
            colores: colores ? colores.split(",") : [],
            personalizable,
            precio,
            cantidadUnidades,
            destacado,
            imagenSrc,
            imagenes: imagenSrc ? [{ src: imagenSrc, alt: nombre }] : []
        });

        await nuevoProducto.save();
        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error("Error al crear el producto:", error);
        res.status(400).json({ error: "Error al crear el producto" });
    }
};

// Obtener productos destacados
export const obtenerProductosDestacados = async (req, res) => {
    try {
        const productosDestacados = await Product.find({ destacado: true });
        res.json(productosDestacados);
    } catch (error) {
        console.error("Error al obtener productos destacados:", error);
        res.status(500).json({ error: "Error al obtener productos destacados" });
    }
};
