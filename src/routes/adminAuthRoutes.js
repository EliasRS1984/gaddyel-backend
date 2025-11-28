// routes/adminAuthRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import adminAuthController from "../controllers/adminAuthController.js";

// Middleware de validación
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validación fallida',
            details: errors.array().map(e => ({ field: e.param, message: e.msg }))
        });
    }
    next();
};

export default function adminAuthRouter(loginLimiter) {
    const router = express.Router();

    // Registrar (temporal)
    router.post(
        "/registrar",
        [
            body('usuario')
                .trim()
                .isLength({ min: 3, max: 30 })
                .withMessage('Usuario debe tener 3-30 caracteres')
                .matches(/^[a-zA-Z0-9_]+$/)
                .withMessage('Usuario solo puede contener letras, números y guiones bajos'),
            body('password')
                .isLength({ min: 8, max: 50 })
                .withMessage('Contraseña debe tener 8-50 caracteres')
        ],
        validateInput,
        adminAuthController.register
    );

    // Login (con limiter y validación)
    router.post(
        "/login",
        [
            body('usuario')
                .trim()
                .isLength({ min: 3, max: 30 })
                .withMessage('Usuario inválido'),
            body('password')
                .isLength({ min: 8 })
                .withMessage('Contraseña inválida')
        ],
        validateInput,
        loginLimiter,
        adminAuthController.login
    );

    // Refresh token
    router.post("/refresh", adminAuthController.refresh);

    // Logout
    router.post("/logout", adminAuthController.logout);

    return router;
}
