import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

const clientFields = [
  "photo", "firstName", "lastName", "birthPlace", "gender", "profession",
  "address", "phonePrimary", "phoneSecondary", "email", "docType", "docNumber",
  "docDeliveryAddress", "docImage", "nif", "rc", "nis", "art",
];
const dateFields = ["birthDate", "docDeliveryDate", "docExpiry"];

function buildClientData(body) {
  const data = {};
  for (const f of clientFields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  for (const f of dateFields) {
    if (body[f]) data[f] = new Date(body[f]);
    else if (body[f] === "" || body[f] === null) data[f] = null;
  }
  return data;
}

// GET /api/clients  — with aggregate stats
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phonePrimary: { contains: search } },
        { email: { contains: search } },
      ];
    }
    const clients = await prisma.client.findMany({
      where,
      include: { purchases: true, sales: true },
      orderBy: { createdAt: "desc" },
    });
    const result = clients.map((c) => {
      const totalPurchases = c.purchases.length;
      const totalSales = c.sales.length;
      const salePaid = c.sales.reduce((a, s) => a + s.amountPaid, 0);
      const saleRest = c.sales.reduce((a, s) => a + s.amountRest, 0);
      const { purchases, sales, ...rest } = c;
      return {
        ...rest,
        stats: { totalPurchases, totalSales, salePaid, saleRest },
      };
    });
    res.json(result);
  })
);

// GET /api/clients/:id/history
router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const purchases = await prisma.purchase.findMany({
      where: { clientId: id },
      include: { car: true, payments: true },
      orderBy: { date: "desc" },
    });
    const sales = await prisma.sale.findMany({
      where: { clientId: id },
      include: { car: true, payments: true },
      orderBy: { date: "desc" },
    });
    const totalPurchaseAmount = purchases.reduce((a, p) => a + p.purchasePrice, 0);
    const totalSaleAmount = sales.reduce((a, s) => a + s.totalAfterReduction, 0);
    const totalPaid = sales.reduce((a, s) => a + s.amountPaid, 0);
    const totalRest = sales.reduce((a, s) => a + s.amountRest, 0);
    res.json({
      purchases: purchases.map((p) => ({ ...p, car: serializeCar(p.car) })),
      sales: sales.map((s) => ({ ...s, car: serializeCar(s.car) })),
      stats: { totalPurchaseAmount, totalSaleAmount, totalPaid, totalRest },
    });
  })
);

// POST /api/clients
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = buildClientData(req.body);
    if (!data.firstName || !data.lastName || !data.phonePrimary) {
      return res.status(400).json({ error: "Prénom, nom et mobile principal requis" });
    }
    const client = await prisma.client.create({ data });
    res.status(201).json(client);
  })
);

// PUT /api/clients/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = buildClientData(req.body);
    const client = await prisma.client.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(client);
  })
);

// DELETE /api/clients/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.client.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

export default router;
