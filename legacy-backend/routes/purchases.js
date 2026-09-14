import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializePurchase, makeReference } from "../lib/serialize.js";

const router = express.Router();

const include = {
  car: true,
  supplier: true,
  client: true,
  payments: { orderBy: { date: "desc" } },
};

// GET /api/purchases  (filters: sourceType, paid, search, from, to)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { sourceType, paid, search, from, to } = req.query;
    const where = {};
    if (sourceType) where.sourceType = sourceType;
    if (paid === "PAID") where.amountRest = { lte: 0 };
    if (paid === "DEBT") where.amountRest = { gt: 0 };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + "T23:59:59");
    }
    if (search) {
      where.car = {
        OR: [
          { brand: { contains: search } },
          { model: { contains: search } },
          { plate: { contains: search } },
        ],
      };
    }
    const purchases = await prisma.purchase.findMany({
      where,
      include,
      orderBy: { date: "desc" },
    });
    res.json(purchases.map(serializePurchase));
  })
);

// GET /api/purchases/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchase = await prisma.purchase.findUnique({
      where: { id: Number(req.params.id) },
      include,
    });
    if (!purchase) return res.status(404).json({ error: "Achat introuvable" });
    res.json(serializePurchase(purchase));
  })
);

// POST /api/purchases  — creates car + purchase + initial payment
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      sourceType = "SUPPLIER",
      supplierId,
      clientId,
      car = {},
      purchasePrice = 0,
      sellingPrice = 0,
      amountPaid = 0,
      inspection = {},
      date,
    } = req.body;

    const pPrice = Number(purchasePrice) || 0;
    const paid = Number(amountPaid) || 0;
    const rest = Math.max(0, pPrice - paid);

    const result = await prisma.$transaction(async (tx) => {
      const createdCar = await tx.car.create({
        data: {
          images: JSON.stringify(car.images || []),
          brand: car.brand || "—",
          model: car.model || "—",
          plate: car.plate || null,
          year: car.year ? Number(car.year) : null,
          color: car.color || null,
          fiche: car.fiche || null,
          energy: car.energy || "ESSENCE",
          gearbox: car.gearbox || "MANUAL",
          seats: car.seats ? Number(car.seats) : null,
          mileage: car.mileage ? Number(car.mileage) : null,
          vin: car.vin || null,
          keysCount: car.keysCount ? Number(car.keysCount) : null,
          documents: JSON.stringify(car.documents || []),
          status: "AVAILABLE",
        },
      });

      const purchase = await tx.purchase.create({
        data: {
          sourceType,
          supplierId: sourceType === "SUPPLIER" && supplierId ? Number(supplierId) : null,
          clientId: sourceType === "CLIENT" && clientId ? Number(clientId) : null,
          carId: createdCar.id,
          purchasePrice: pPrice,
          sellingPrice: Number(sellingPrice) || 0,
          amountPaid: paid,
          amountRest: rest,
          date: date ? new Date(date) : new Date(),
          inspection: JSON.stringify(inspection || {}),
        },
      });

      const reference = makeReference("ACH", purchase.id);
      await tx.purchase.update({ where: { id: purchase.id }, data: { reference } });

      if (paid > 0) {
        await tx.purchasePayment.create({
          data: {
            purchaseId: purchase.id,
            amount: paid,
            date: date ? new Date(date) : new Date(),
            description: "Versement initial",
          },
        });
      }

      return tx.purchase.findUnique({ where: { id: purchase.id }, include });
    });

    res.status(201).json(serializePurchase(result));
  })
);

// PUT /api/purchases/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { car = {}, purchasePrice, sellingPrice, amountPaid, inspection, date, sourceType, supplierId, clientId } = req.body;

    const existing = await prisma.purchase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Achat introuvable" });

    const pPrice = purchasePrice !== undefined ? Number(purchasePrice) : existing.purchasePrice;
    const paid = amountPaid !== undefined ? Number(amountPaid) : existing.amountPaid;
    const rest = Math.max(0, pPrice - paid);

    await prisma.$transaction(async (tx) => {
      if (car && Object.keys(car).length) {
        const carData = { ...car };
        if (carData.images) carData.images = JSON.stringify(carData.images);
        if (carData.documents) carData.documents = JSON.stringify(carData.documents);
        if (carData.year) carData.year = Number(carData.year);
        if (carData.seats) carData.seats = Number(carData.seats);
        if (carData.mileage) carData.mileage = Number(carData.mileage);
        if (carData.keysCount) carData.keysCount = Number(carData.keysCount);
        delete carData.id;
        await tx.car.update({ where: { id: existing.carId }, data: carData });
      }
      await tx.purchase.update({
        where: { id },
        data: {
          sourceType: sourceType || existing.sourceType,
          supplierId: supplierId !== undefined ? (supplierId ? Number(supplierId) : null) : existing.supplierId,
          clientId: clientId !== undefined ? (clientId ? Number(clientId) : null) : existing.clientId,
          purchasePrice: pPrice,
          sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : existing.sellingPrice,
          amountPaid: paid,
          amountRest: rest,
          date: date ? new Date(date) : existing.date,
          inspection: inspection !== undefined ? JSON.stringify(inspection) : existing.inspection,
        },
      });
    });

    const updated = await prisma.purchase.findUnique({ where: { id }, include });
    res.json(serializePurchase(updated));
  })
);

// DELETE /api/purchases/:id  (also deletes the car)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const purchase = await prisma.purchase.findUnique({ where: { id } });
    if (!purchase) return res.status(404).json({ error: "Achat introuvable" });
    await prisma.$transaction(async (tx) => {
      await tx.purchase.delete({ where: { id } });
      await tx.car.delete({ where: { id: purchase.carId } }).catch(() => {});
    });
    res.json({ ok: true });
  })
);

// POST /api/purchases/:id/payments  — pay debt
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { amount, description, date } = req.body;
    const amt = Number(amount) || 0;
    if (amt <= 0) return res.status(400).json({ error: "Montant invalide" });

    const purchase = await prisma.purchase.findUnique({ where: { id } });
    if (!purchase) return res.status(404).json({ error: "Achat introuvable" });

    const newPaid = purchase.amountPaid + amt;
    const newRest = Math.max(0, purchase.purchasePrice - newPaid);

    await prisma.$transaction([
      prisma.purchasePayment.create({
        data: { purchaseId: id, amount: amt, description: description || "Règlement", date: date ? new Date(date) : new Date() },
      }),
      prisma.purchase.update({
        where: { id },
        data: { amountPaid: newPaid, amountRest: newRest },
      }),
    ]);

    const updated = await prisma.purchase.findUnique({ where: { id }, include });
    res.json(serializePurchase(updated));
  })
);

export default router;
