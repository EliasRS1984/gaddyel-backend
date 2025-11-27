import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "Token requerido" });
    }

    try {
        // Aceptar varias variables de entorno por compatibilidad
        const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ error: 'JWT secret no configurado en el servidor' });
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: "Token inválido o expirado" });
    }
};

export default verifyToken;
