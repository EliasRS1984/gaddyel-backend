/**
 * Middlewares: Security & Validation
 * Descripción: Middlewares de seguridad, logging y validación
 * Propósito: Proteger rutas, validar datos, loguear solicitudes
 */

const rateLimit = require('express-rate-limit');
const { logAudit, logSecurity } = require('../utils/logger');
const crypto = require('crypto');

/**
 * Middleware: Error handler centralizado
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  logAudit('ERROR_HANDLER', {
    message: err.message,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
  }, 'ERROR');

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Middleware: Logger de solicitudes
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logAudit('HTTP_REQUEST', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, 'INFO');

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware: Rate limiting general
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP, intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.ip,
});

/**
 * Middleware: Rate limiting para login/checkout
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 requests
  message: 'Demasiados intentos, intente más tarde',
  skipSuccessfulRequests: true, // No contar requests exitosos
  keyGenerator: (req) => req.ip,
});

/**
 * Middleware: Rate limiting para webhooks
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requests
  skipFailedRequests: false,
});

/**
 * Middleware: Validar que el cuerpo de la solicitud es JSON
 */
const validateJSON = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logSecurity('INVALID_JSON_REQUEST', 'medium', {
      path: req.path,
      ip: req.ip,
    });

    return res.status(400).json({
      success: false,
      error: 'JSON inválido en el cuerpo de la solicitud',
    });
  }
  next(err);
};

/**
 * Middleware: Generar request ID para trazabilidad
 */
const generateRequestId = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * Middleware: Validar origin (CORS simplificado)
 */
const validateOrigin = (req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ];

  const origin = req.get('origin');

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  next();
};

/**
 * Middleware: Prevenir clickjacking
 */
const securityHeaders = (req, res, next) => {
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict-Transport-Security
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content-Security-Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  next();
};

/**
 * Middleware: Sanitizar inputs básico
 */
const sanitizeInputs = (req, res, next) => {
  // Remover scripts potenciales
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * Middleware: Detectar actividad sospechosa
 */
const detectAnomalies = (req, res, next) => {
  // Detectar patrones sospechosos
  const suspiciousPatterns = [
    /(\.\.)|(\/\/)|(%2e%2e)|(%2f%2f)/gi, // Path traversal
    /union[\s]*select/gi, // SQL Injection
    /drop[\s]*table/gi, // SQL Injection
    /<iframe/gi, // XSS
  ];

  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return false;
    for (const key in obj) {
      if (checkString(key) || checkString(obj[key])) {
        return true;
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query)) {
    logSecurity('SUSPICIOUS_REQUEST_DETECTED', 'high', {
      path: req.path,
      ip: req.ip,
      body: Object.keys(req.body || {}),
    });

    return res.status(400).json({
      success: false,
      error: 'Solicitud sospechosa detectada',
    });
  }

  next();
};

/**
 * Middleware: Verificar que es una solicitud a una ruta válida
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path,
  });
};

module.exports = {
  errorHandler,
  requestLogger,
  apiLimiter,
  strictLimiter,
  webhookLimiter,
  validateJSON,
  generateRequestId,
  validateOrigin,
  securityHeaders,
  sanitizeInputs,
  detectAnomalies,
  notFound,
};
