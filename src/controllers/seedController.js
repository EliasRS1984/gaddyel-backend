/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador de carga inicial de datos (seed).
 * Importa el catálogo de productos desde un archivo JSON local
 * a la base de datos. Se usa una sola vez para poblar el catálogo.
 *
 * ¿CÓMO FUNCIONA?
 * 1. Lee el archivo Data/productos.json del servidor.
 * 2. Borra todos los productos existentes en la base de datos.
 * 3. Inserta los productos del JSON como registros nuevos.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿Error "archivo no encontrado"? → Verificar que exista el archivo Data/productos.json
 * - ¿Error de validación? → Revisar que el JSON tenga todos los campos requeridos por el modelo
 * - ADVERTENCIA: Esta operación borra y recrea todos los productos. Úsarla con cuidado.
 * ======================================================
 */

import fs from "fs/promises";
import { Producto } from "../models/Product.js";
import logger from "../utils/logger.js";


// ======== IMPORTAR PRODUCTOS DESDE JSON ========
// Al llamar a este endpoint, se borran todos los productos actuales y se cargan
// los que están en el archivo productos.json. Solo para administradores.
// ¿El archivo no existe? → Verificar la ruta Data/productos.json en el servidor.

export const importarProductos = async (req, res) => {
    try {
        const data     = await fs.readFile("./Data/productos.json", "utf-8");
        const productos = JSON.parse(data);

        await Producto.deleteMany();
        const insertados = await Producto.insertMany(productos);

        logger.info(`Seed: ${insertados.length} productos importados`);
        res.status(201).json({
            mensaje:  "Productos importados correctamente",
            cantidad: insertados.length
        });
    } catch (error) {
        logger.error("Seed: Error al importar productos", { message: error.message });
        res.status(500).json({ error: "Error al importar los productos" });
    }
};
