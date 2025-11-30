// routes/adminAuthRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";

export default function adminAuthRouter(loginLimiter) {
    const router = express.Router();

    // Registrar admin (solo temporal para crear el primero)
    router.post("/registrar", async (req, res) => {
        try {
            const { usuario, password } = req.body;

            const existente = await Admin.findOne({ usuario });
            if (existente) return res.status(400).json({ error: "El usuario ya existe" });

            const hash = await bcrypt.hash(password, 10);

            const nuevoAdmin = new Admin({
                usuario,
                password: hash,
            });

            await nuevoAdmin.save();
            res.json({ mensaje: "Admin registrado correctamente", admin: nuevoAdmin });

        } catch (error) {
            res.status(500).json({ error: "Error registrando admin" });
        }
    });

    // Login (con limiter)
    router.post("/login", loginLimiter, async (req, res) => {
        try {
            const { usuario, password } = req.body;

            const admin = await Admin.findOne({ usuario });
            if (!admin) return res.status(404).json({ error: "Usuario no encontrado" });

            const valid = await bcrypt.compare(password, admin.password);
            if (!valid) return res.status(401).json({ error: "Password incorrecto" });

            const token = jwt.sign(
                { id: admin._id, usuario: admin.usuario },
                process.env.JWT_SECRET_KEY,
                { expiresIn: "7d" }
            );

            res.json({ mensaje: "Login correcto", token });

        } catch (error) {
            res.status(500).json({ error: "Error en servidor" });
        }
    });

    return router;
}
