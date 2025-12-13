import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    console.log('🔐 [authMiddleware] Verificando token...');
    console.log('   Header:', authHeader ? 'Presente' : 'Ausente');
    console.log('   Token:', token ? '✅ Presente' : '❌ Ausente');

    if (!token) {
        console.log('❌ Token requerido pero no encontrado');
        return res.status(403).json({ error: "Token requerido" });
    }

    try {
        // Aceptar varias variables de entorno por compatibilidad
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET_KEY;
        if (!secret) {
            console.error('❌ JWT secret no configurado');
            return res.status(500).json({ error: 'JWT secret no configurado en el servidor' });
        }
        const decoded = jwt.verify(token, secret);
        console.log('✅ Token válido. Usuario:', decoded.id || decoded.usuario);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Token inválido:', error.message);
        res.status(401).json({ error: "Token inválido o expirado" });
    }
};

export default verifyToken;
