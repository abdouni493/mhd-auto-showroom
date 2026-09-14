import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

const include = { car: true };
const serialize = (e) => ({ ...e, car: e.car ? serializeCar(e.car) : e.car });

// GET /api/expenses  (?type=CAR|SHOWROOM)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, search, from, to } = req.query;
    const where = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    // Period filter used by the printable expenses report
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(`${to}T23:59:59.999`);
    }
    const expenses = await prisma.expense.findMany({
      where,
      include,
      orderBy: { date: "desc" },
    });
    res.json(expenses.map(serialize));
  })
);

// POST /api/expenses
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { type = "SHOWROOM", carId, name, description, amount, date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: "Nom et montant requis" });
    }
    const expense = await prisma.expense.create({
      data: {
        type,
        carId: type === "CAR" && carId ? Number(carId) : null,
        name,
        description: description || null,
        amount: Number(amount) || 0,
        date: date ? new Date(date) : new Date(),
      },
      include,
    });
    res.status(201).json(serialize(expense));
  })
);

// PUT /api/expenses/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { type, carId, name, description, amount, date } = req.body;
    const data = {};
    if (type !== undefined) data.type = type;
    if (carId !== undefined) data.carId = carId ? Number(carId) : null;
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (amount !== undefined) data.amount = Number(amount);
    if (date) data.date = new Date(date);
    const expense = await prisma.expense.update({
      where: { id: Number(req.params.id) },
      data,
      include,
    });
    res.json(serialize(expense));
  })
);

// DELETE /api/expenses/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

export default router;
