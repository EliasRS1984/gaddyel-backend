import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwtConfig.js';
import logger from '../utils/logger.js';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    // ✅ Log solo en desarrollo
    logger.debug('Verificando token...', { token: token ? 'presente' : 'ausente' });

    if (!token) {
        logger.warn('Token no proporcionado', { ip: req.ip, path: req.path });
        return res.status(403).json({ error: "Token requerido" });
    }

    try {
        // ✅ Usar configuración centralizada
        const decoded = jwt.verify(token, JWT_CONFIG.accessSecret);
        logger.debug('✅ Token válido', { user: decoded.id || decoded.usuario });
        req.user = decoded;
        next();
    } catch (error) {
        // ✅ Log de errores de seguridad siempre
        logger.security('Token inválido', { 
            ip: req.ip, 
            error: error.message,
            path: req.path 
        });
        
        // Manejar específicamente token expirado
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Token expirado" });
        }
        
        res.status(401).json({ error: "Token inválido" });
    }
};

export default verifyToken;
