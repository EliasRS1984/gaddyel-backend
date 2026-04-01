/*
 * ======================================================
 * ¿QUÉ ES ESTO?
 * Controlador del carrusel de imágenes de la página principal.
 * Permite al administrador agregar, editar, reordenar y eliminar
 * las imágenes que se muestran en el slider del sitio.
 *
 * ¿CÓMO FUNCIONA?
 * 1. El sitio público solicita las imágenes activas (solo las visibles).
 * 2. El panel de admin carga todas las imágenes (activas e inactivas).
 * 3. El admin puede agregar nuevas imágenes (URL de Cloudinary), editarlas,
 *    cambiar su orden y activarlas o desactivarlas.
 * 4. Al eliminar, si la imagen tiene publicId de Cloudinary, también se borra en la nube.
 * 5. El reordenamiento actualiza el número de posición de cada imágen en un solo paso.
 *
 * ¿DÓNDE BUSCAR SI HAY PROBLEMAS?
 * - ¿El carrusel no muestra imágenes? → Revisar obtenerImagenesCarrusel (solo activas)
 * - ¿El admin no puede agregar imágenes? → Revisar crearImagenCarrusel (validar URL)
 * - ¿La imagen no se borra de Cloudinary? → Revisar que imagen.publicId esté guardado
 * - ¿El orden no se guarda? → Revisar reordenarImagenesCarrusel y el array enviado
 * ======================================================
 */

import { CarouselImage } from "../models/CarouselImage.js";
import logger from "../utils/logger.js";
import cloudinary from '../config/cloudinary.js';


// ======== CARRUSEL PÚBLICO (solo imágenes activas) ========
// El sitio web llama a esta función para mostrar las imágenes en el slider.
// ¿Las imágenes no aparecen en el sitio? → Verificar que estén marcadas como activas.

export const obtenerImagenesCarrusel = async (req, res, next) => {
    try {
        const imagenes = await CarouselImage.find({ activo: true })
            .sort({ orden: 1 })
            .select('-__v')
            .lean();

        res.json({ success: true, data: imagenes });
    } catch (error) {
        logger.error("Error al obtener imágenes del carrusel:", error.message);
        next(error);
    }
};


// ======== CARRUSEL ADMIN (todas las imágenes) ========
// El panel de administración llama a esta función para ver todas las imágenes,
// incluyendo las que están desactivadas.

export const obtenerTodasImagenesCarrusel = async (req, res, next) => {
    try {
        const imagenes = await CarouselImage.find()
            .sort({ orden: 1 })
            .select('-__v')
            .lean();

        res.json({ success: true, data: imagenes });
    } catch (error) {
        logger.error("Error al obtener todas las imágenes del carrusel:", error.message);
        next(error);
    }
};


// ======== AGREGAR IMAGEN AL CARRUSEL ========
// El admin sube la imagen a Cloudinary desde el frontend y luego envía
// la URL resultante aquí para guardarla en la base de datos.
// ¿La imagen no se guarda? → Verificar que el campo 'src' (URL) no esté vacío.

export const crearImagenCarrusel = async (req, res, next) => {
    try {
        const { src, alt, caption, orden, activo, publicId } = req.body;

        if (!src || src.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'La URL de la imagen es obligatoria'
            });
        }

        const nuevaImagen = new CarouselImage({
            src:      src.trim(),
            alt:      alt?.trim() || "Imagen del carrusel Gaddyel",
            caption:  caption?.trim() || "",
            orden:    orden || 0,
            activo:   activo !== undefined ? activo : true,
            publicId: publicId || null
        });

        await nuevaImagen.save();
        logger.info(`Imagen de carrusel creada: ${nuevaImagen._id}`);

        res.status(201).json({
            success: true,
            message: 'Imagen agregada al carrusel exitosamente',
            data:    nuevaImagen
        });
    } catch (error) {
        logger.error("Error al crear imagen del carrusel:", error.message);
        next(error);
    }
};


// ======== EDITAR IMAGEN DEL CARRUSEL ========
// El admin puede cambiar el texto alternativo, el título, el orden o el estado
// de visibilidad de una imagen sin necesidad de volver a subirla.

export const actualizarImagenCarrusel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { src, alt, caption, orden, activo } = req.body;

        const imagen = await CarouselImage.findById(id);
        if (!imagen) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        if (src     !== undefined) imagen.src     = src.trim();
        if (alt     !== undefined) imagen.alt     = alt.trim();
        if (caption !== undefined) imagen.caption = caption.trim();
        if (orden   !== undefined) imagen.orden   = orden;
        if (activo  !== undefined) imagen.activo  = activo;

        await imagen.save();
        logger.info(`Imagen de carrusel actualizada: ${id}`);

        res.json({ success: true, message: 'Imagen actualizada exitosamente', data: imagen });
    } catch (error) {
        logger.error("Error al actualizar imagen del carrusel:", error.message);
        next(error);
    }
};


// ======== ELIMINAR IMAGEN DEL CARRUSEL ========
// Borra la imagen de la base de datos. Si la imagen fue subida a Cloudinary
// y tiene un publicId guardado, también la elimina de la nube.
// ¿La imagen sigue apareciendo en Cloudinary? → Verificar que publicId esté guardado correctamente.

export const eliminarImagenCarrusel = async (req, res, next) => {
    try {
        const { id } = req.params;

        const imagen = await CarouselImage.findById(id);
        if (!imagen) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        // Si tiene publicId de Cloudinary, eliminar el archivo de la nube también
        if (imagen.publicId) {
            try {
                await cloudinary.uploader.destroy(imagen.publicId);
                logger.info(`Imagen eliminada de Cloudinary: ${imagen.publicId}`);
            } catch (cloudinaryError) {
                // No bloquear la eliminación en base de datos si Cloudinary falla
                logger.warn(`No se pudo eliminar de Cloudinary: ${cloudinaryError.message}`);
            }
        }

        await CarouselImage.findByIdAndDelete(id);
        logger.info(`Imagen de carrusel eliminada de la base de datos: ${id}`);

        res.json({ success: true, message: 'Imagen eliminada exitosamente' });
    } catch (error) {
        logger.error("Error al eliminar imagen del carrusel:", error.message);
        next(error);
    }
};


// ======== REORDENAR IMÁGENES DEL CARRUSEL ========
// Cuando el admin arrastra y suelta imágenes en el panel, esta función
// guarda el nuevo orden de todas ellas en un solo paso.
// ¿El orden no se guarda? → Verificar que el array enviado tenga formato [{ id, orden }].

export const reordenarImagenesCarrusel = async (req, res, next) => {
    try {
        const { orden } = req.body;

        if (!Array.isArray(orden)) {
            return res.status(400).json({
                success: false,
                message: 'El campo "orden" debe ser un array'
            });
        }

        // Actualizar el número de orden de cada imagen en paralelo
        const actualizaciones = orden.map(({ id, orden: nuevoOrden }) =>
            CarouselImage.findByIdAndUpdate(id, { orden: nuevoOrden })
        );

        await Promise.all(actualizaciones);
        logger.info('Orden de imágenes del carrusel actualizado');

        res.json({ success: true, message: 'Orden actualizado exitosamente' });
    } catch (error) {
        logger.error("Error al reordenar imágenes del carrusel:", error.message);
        next(error);
    }
};
