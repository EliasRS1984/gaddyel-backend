import fs from "fs";
import { Producto } from "../models/Product.js";

export const importarProductos = async (req, res) => {
    try {
        const data = fs.readFileSync("./data/productos.json", "utf-8");
        const productos = JSON.parse(data);

        await Producto.deleteMany(); // Limpia los productos anteriores
        const insertados = await Producto.insertMany(productos);

        res.status(201).json({
            mensaje: "Productos importados correctamente",
            cantidad: insertados.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al importar los productos" });
    }
};
