import fs from "fs";
import Product from "../models/Product.js";

/**
 * Controlador: Importar Productos
 * Importa productos desde un archivo JSON
 */
export const importarProductos = async (req, res) => {
    try {
        const data = fs.readFileSync("./data/productos.json", "utf-8");
        const productos = JSON.parse(data);

        // Limpia los productos anteriores
        await Product.deleteMany();
        const insertados = await Product.insertMany(productos);

        res.status(201).json({
            mensaje: "Productos importados correctamente",
            cantidad: insertados.length
        });
    } catch (error) {
        console.error("Error importing products:", error);
        res.status(500).json({ error: "Error al importar los productos" });
    }
};
