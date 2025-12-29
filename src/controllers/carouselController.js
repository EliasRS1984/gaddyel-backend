import { CarouselImage } from "../models/CarouselImage.js";
import logger from "../utils/logger.js";
import cloudinary from '../config/cloudinary.js';

/**
 * Obtener todas las imágenes del carrusel (públicas - solo activas)
 */
export const obtenerImagenesCarrusel = async (req, res, next) => {
    try {
        const imagenes = await CarouselImage.find({ activo: true })
            .sort({ orden: 1 })
            .select('-__v')
            .lean();

        res.json({
            success: true,
            data: imagenes
        });
    } catch (error) {
        logger.error("Error al obtener imágenes del carrusel:", error.message);
        next(error);
    }
};

/**
 * Obtener todas las imágenes (admin - incluye inactivas)
 */
export const obtenerTodasImagenesCarrusel = async (req, res, next) => {
    try {
        const imagenes = await CarouselImage.find()
            .sort({ orden: 1 })
            .select('-__v')
            .lean();

        res.json({
            success: true,
            data: imagenes
        });
    } catch (error) {
        logger.error("Error al obtener todas las imágenes del carrusel:", error.message);
        next(error);
    }
};

/**
 * Crear nueva imagen en el carrusel
 */
export const crearImagenCarrusel = async (req, res, next) => {
    try {
        const { src, alt, caption, orden, activo, publicId } = req.body;

        // Validar que src no esté vacío
        if (!src || src.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'La URL de la imagen es obligatoria'
            });
        }

        const nuevaImagen = new CarouselImage({
            src: src.trim(),
            alt: alt?.trim() || "Imagen del carrusel Gaddyel",
            caption: caption?.trim() || "",
            orden: orden || 0,
            activo: activo !== undefined ? activo : true,
            publicId: publicId || null
        });

        await nuevaImagen.save();

        logger.info(`Imagen de carrusel creada: ${nuevaImagen._id}`);

        res.status(201).json({
            success: true,
            message: 'Imagen agregada al carrusel exitosamente',
            data: nuevaImagen
        });
    } catch (error) {
        logger.error("Error al crear imagen del carrusel:", error.message);
        next(error);
    }
};

/**
 * Actualizar imagen del carrusel
 */
export const actualizarImagenCarrusel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { src, alt, caption, orden, activo } = req.body;

        const imagen = await CarouselImage.findById(id);
        if (!imagen) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        // Actualizar campos
        if (src !== undefined) imagen.src = src.trim();
        if (alt !== undefined) imagen.alt = alt.trim();
        if (caption !== undefined) imagen.caption = caption.trim();
        if (orden !== undefined) imagen.orden = orden;
        if (activo !== undefined) imagen.activo = activo;

        await imagen.save();

        logger.info(`Imagen de carrusel actualizada: ${id}`);

        res.json({
            success: true,
            message: 'Imagen actualizada exitosamente',
            data: imagen
        });
    } catch (error) {
        logger.error("Error al actualizar imagen del carrusel:", error.message);
        next(error);
    }
};

/**
 * Eliminar imagen del carrusel
 */
export const eliminarImagenCarrusel = async (req, res, next) => {
    try {
        const { id } = req.params;

        const imagen = await CarouselImage.findById(id);
        if (!imagen) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        // Si tiene publicId de Cloudinary, intentar eliminar
        if (imagen.publicId) {
            try {
                await cloudinary.uploader.destroy(imagen.publicId);
                logger.info(`Imagen eliminada de Cloudinary: ${imagen.publicId}`);
            } catch (cloudinaryError) {
                logger.warn(`No se pudo eliminar de Cloudinary: ${cloudinaryError.message}`);
            }
        }

        await CarouselImage.findByIdAndDelete(id);

        logger.info(`Imagen de carrusel eliminada: ${id}`);

        res.json({
            success: true,
            message: 'Imagen eliminada exitosamente'
        });
    } catch (error) {
        logger.error("Error al eliminar imagen del carrusel:", error.message);
        next(error);
    }
};

/**
 * Reordenar imágenes del carrusel
 */
export const reordenarImagenesCarrusel = async (req, res, next) => {
    try {
        const { orden } = req.body; // Array de { id, orden }

        if (!Array.isArray(orden)) {
            return res.status(400).json({
                success: false,
                message: 'El campo "orden" debe ser un array'
            });
        }

        // Actualizar orden de cada imagen
        const actualizaciones = orden.map(({ id, orden: nuevoOrden }) =>
            CarouselImage.findByIdAndUpdate(id, { orden: nuevoOrden })
        );

        await Promise.all(actualizaciones);

        logger.info('Orden de imágenes del carrusel actualizado');

        res.json({
            success: true,
            message: 'Orden actualizado exitosamente'
        });
    } catch (error) {
        logger.error("Error al reordenar imágenes del carrusel:", error.message);
        next(error);
    }
};
