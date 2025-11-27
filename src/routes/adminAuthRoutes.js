// routes/adminAuthRoutes.js
import express from "express";
import adminAuthController from "../controllers/adminAuthController.js";

export default function adminAuthRouter(loginLimiter) {
    const router = express.Router();

    // Registrar (temporal)
    router.post("/registrar", adminAuthController.register);

    // Login (con limiter)
    router.post("/login", loginLimiter, adminAuthController.login);

    // Refresh token
    router.post("/refresh", adminAuthController.refresh);

    // Logout
    router.post("/logout", adminAuthController.logout);

    return router;
}
