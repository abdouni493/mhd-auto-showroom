import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = express.Router();

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { fullName, username, email, password } = req.body;
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Un compte avec cet email ou nom d'utilisateur existe déjà" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { fullName, username, email, passwordHash, role: "ADMIN" },
    });

    const token = signToken({ id: user.id, role: user.role, username: user.username });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      token,
      user: { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: user.role },
    });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: email }] },
    });
    if (!user) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const token = signToken({ id: user.id, role: user.role, username: user.username });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: user.role },
    });
  })
);

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

// GET /api/auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({
      user: { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: user.role },
    });
  })
);

// PUT /api/auth/me  (update own account)
router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { fullName, username, email, password } = req.body;
    const data = {};
    if (fullName) data.fullName = fullName;
    if (username) data.username = username;
    if (email) data.email = email;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });
    res.json({
      user: { id: user.id, fullName: user.fullName, username: user.username, email: user.email, role: user.role },
    });
  })
);

export default router;
