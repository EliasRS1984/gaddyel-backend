// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
    console.error(err); // logs del servidor
    const status = err.status || 500;
    const message = err.message || "Error del servidor";
    res.status(status).json({ error: message });
};
