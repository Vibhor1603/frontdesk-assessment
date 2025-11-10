import express from "express";
import { generateToken } from "../controllers/auth/authController.js";

const router = express.Router();

router.post("/token", generateToken);

export default router;
