import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },

    // Estandarizado a "password"
    password: { type: String, required: true },
});

// 🔁 Middleware opcional para compatibilidad
// Si por error alguien envía "contraseña", lo convertimos a "password"
adminSchema.pre("validate", function (next) {
    if (this.contraseña && !this.password) {
        this.password = this.contraseña;
        this.contraseña = undefined;
    }
    next();
});

export default mongoose.model("Admin", adminSchema);
