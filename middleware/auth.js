const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

/**
 * Middleware de autenticación JWT
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Buscar usuario
    const user = await AdminUser.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Verificar si está bloqueado
    if (user.isLocked()) {
      return res.status(403).json({ error: 'Account is temporarily locked' });
    }

    // Agregar usuario al request
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware de roles
 */
const roleMiddleware = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (requiredRoles.length === 0 || requiredRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

/**
 * Middleware de límite de tasa
 */
const rateLimitMiddleware = (() => {
  const attempts = new Map();
  const maxAttempts = 100;
  const windowMs = 15 * 60 * 1000; // 15 minutos

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!attempts.has(ip)) {
      attempts.set(ip, []);
    }

    const userAttempts = attempts.get(ip).filter(time => now - time < windowMs);

    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    userAttempts.push(now);
    attempts.set(ip, userAttempts);

    next();
  };
})();

/**
 * Middleware CORS
 */
const corsMiddleware = (req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://gaddyel.vercel.app'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

/**
 * Middleware de sanitización
 */
const sanitizeMiddleware = (req, res, next) => {
  const sanitizeInput = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remover caracteres peligrosos
        obj[key] = obj[key]
          .replace(/[<>\"']/g, '')
          .trim();
      } else if (typeof obj[key] === 'object') {
        sanitizeInput(obj[key]);
      }
    }
  };

  sanitizeInput(req.body);
  sanitizeInput(req.query);

  next();
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  rateLimitMiddleware,
  corsMiddleware,
  sanitizeMiddleware
};
