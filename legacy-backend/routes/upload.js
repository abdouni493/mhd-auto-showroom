import express from "express";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// POST /api/upload/image  — single image
router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// POST /api/upload/images  — multiple images
router.post("/images", upload.array("images", 12), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: "Aucun fichier" });
  res.json({ urls: req.files.map((f) => `/uploads/${f.filename}`) });
});

export default router;
