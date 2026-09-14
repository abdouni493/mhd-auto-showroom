import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

const fullCarInclude = {
  purchase: { include: { supplier: true, client: true, payments: true } },
  sales: {
    include: { client: true, payments: true },
    orderBy: { createdAt: "desc" },
  },
  expenses: { orderBy: { date: "desc" } },
  carPayments: { include: { client: true }, orderBy: { date: "desc" } },
  websiteOffer: true,
};

// GET /api/cars  (optional ?status=)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { brand: { contains: search } },
        { model: { contains: search } },
        { plate: { contains: search } },
      ];
    }
    const cars = await prisma.car.findMany({
      where,
      include: fullCarInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(cars.map(serializeCarFull));
  })
);

// --- Car document types (must come before /:id) ---
// GET /api/cars/document-types
router.get(
  "/document-types",
  asyncHandler(async (req, res) => {
    const types = await prisma.carDocumentType.findMany({ orderBy: { name: "asc" } });
    res.json(types);
  })
);

// POST /api/cars/document-types
router.post(
  "/document-types",
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nom requis" });
    const existing = await prisma.carDocumentType.findUnique({ where: { name: name.trim() } });
    if (existing) return res.json(existing);
    const type = await prisma.carDocumentType.create({ data: { name: name.trim() } });
    res.status(201).json(type);
  })
);

// GET /api/cars/available
router.get(
  "/available",
  asyncHandler(async (req, res) => {
    const cars = await prisma.car.findMany({
      where: { status: "AVAILABLE" },
      include: fullCarInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(cars.map(serializeCarFull));
  })
);

// GET /api/cars/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const car = await prisma.car.findUnique({
      where: { id: Number(req.params.id) },
      include: fullCarInclude,
    });
    if (!car) return res.status(404).json({ error: "Véhicule introuvable" });
    res.json(serializeCarFull(car));
  })
);

// PUT /api/cars/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    if (body.images && Array.isArray(body.images)) {
      body.images = JSON.stringify(body.images);
    }
    if (body.documents && Array.isArray(body.documents)) {
      body.documents = JSON.stringify(body.documents);
    }
    if (body.keysCount !== undefined && body.keysCount !== null && body.keysCount !== "") {
      body.keysCount = Number(body.keysCount);
    }
    delete body.purchase;
    delete body.sales;
    delete body.expenses;
    delete body.carPayments;
    delete body.websiteOffer;
    const car = await prisma.car.update({
      where: { id: Number(req.params.id) },
      data: body,
    });
    res.json(serializeCar(car));
  })
);

// DELETE /api/cars/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.car.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

function serializeCarFull(car) {
  const c = serializeCar(car);
  if (c.purchase) c.purchase.inspection = parseSafe(c.purchase.inspection);
  if (c.sales) c.sales = c.sales.map((s) => ({ ...s, inspection: parseSafe(s.inspection) }));
  return c;
}

function parseSafe(v) {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

export default router;
