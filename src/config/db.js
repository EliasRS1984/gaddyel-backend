import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const conectarDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Conectado a MongoDB correctamente");
    } catch (error) {
        console.error("❌ Error al conectar a MongoDB:", error.message);
        process.exit(1);
    }
};
