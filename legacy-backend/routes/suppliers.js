import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

// GET /api/suppliers  — with aggregate stats
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    const suppliers = await prisma.supplier.findMany({
      where,
      include: { purchases: true },
      orderBy: { createdAt: "desc" },
    });
    const result = suppliers.map((s) => {
      const totalPurchases = s.purchases.length;
      const totalAmount = s.purchases.reduce((a, p) => a + p.purchasePrice, 0);
      const totalPaid = s.purchases.reduce((a, p) => a + p.amountPaid, 0);
      const totalRest = s.purchases.reduce((a, p) => a + p.amountRest, 0);
      const { purchases, ...rest } = s;
      return { ...rest, stats: { totalPurchases, totalAmount, totalPaid, totalRest } };
    });
    res.json(result);
  })
);

// GET /api/suppliers/:id/purchases
router.get(
  "/:id/purchases",
  asyncHandler(async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      where: { supplierId: Number(req.params.id) },
      include: { car: true, payments: true },
      orderBy: { date: "desc" },
    });
    res.json(
      purchases.map((p) => ({ ...p, car: serializeCar(p.car) }))
    );
  })
);

// POST /api/suppliers
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { fullName, phone, address, nif, nis, article, rs } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: "Nom et téléphone requis" });
    }
    const supplier = await prisma.supplier.create({
      data: { fullName, phone, address, nif, nis, article, rs },
    });
    res.status(201).json(supplier);
  })
);

// PUT /api/suppliers/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { fullName, phone, address, nif, nis, article, rs } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: Number(req.params.id) },
      data: { fullName, phone, address, nif, nis, article, rs },
    });
    res.json(supplier);
  })
);

// DELETE /api/suppliers/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.supplier.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

export default router;
