import express from "express";
import { importarProductos } from "../controllers/seedController.js";

const router = express.Router();

router.post("/", importarProductos);

export default router;
