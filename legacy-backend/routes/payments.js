import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

const include = { car: true, client: true, sale: true };

function serialize(p) {
  return { ...p, car: p.car ? serializeCar(p.car) : p.car };
}

// GET /api/payments  (ClientCarPayments)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { car: { brand: { contains: search } } },
        { car: { model: { contains: search } } },
        { car: { plate: { contains: search } } },
        { client: { firstName: { contains: search } } },
        { client: { lastName: { contains: search } } },
      ];
    }
    const payments = await prisma.clientCarPayment.findMany({
      where,
      include,
      orderBy: { date: "desc" },
    });
    res.json(payments.map(serialize));
  })
);

// POST /api/payments  — pays toward a sold/reserved car; also bumps the linked sale
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { carId, clientId, saleId, amount, description, date } = req.body;
    const amt = Number(amount) || 0;
    if (!carId || amt <= 0) {
      return res.status(400).json({ error: "Véhicule et montant requis" });
    }

    // resolve client/sale from car if not provided
    let resolvedClientId = clientId ? Number(clientId) : null;
    let resolvedSaleId = saleId ? Number(saleId) : null;

    if (!resolvedSaleId) {
      const sale = await prisma.sale.findFirst({
        where: { carId: Number(carId) },
        orderBy: { createdAt: "desc" },
      });
      if (sale) {
        resolvedSaleId = sale.id;
        if (!resolvedClientId) resolvedClientId = sale.clientId;
      }
    }
    if (!resolvedClientId) {
      return res.status(400).json({ error: "Client introuvable pour ce véhicule" });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.clientCarPayment.create({
        data: {
          carId: Number(carId),
          clientId: resolvedClientId,
          saleId: resolvedSaleId,
          amount: amt,
          description: description || "Paiement véhicule",
          date: date ? new Date(date) : new Date(),
        },
      });
      // keep the sale balance in sync
      if (resolvedSaleId) {
        const sale = await tx.sale.findUnique({ where: { id: resolvedSaleId } });
        if (sale) {
          const newPaid = sale.amountPaid + amt;
          const newRest = Math.max(0, sale.totalAfterReduction - newPaid);
          await tx.sale.update({ where: { id: resolvedSaleId }, data: { amountPaid: newPaid, amountRest: newRest } });
          await tx.salePayment.create({
            data: { saleId: resolvedSaleId, amount: amt, description: "Paiement véhicule", date: date ? new Date(date) : new Date() },
          });
        }
      }
      return tx.clientCarPayment.findUnique({ where: { id: p.id }, include });
    });

    res.status(201).json(serialize(payment));
  })
);

// PUT /api/payments/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { amount, description, date } = req.body;
    const data = {};
    if (amount !== undefined) data.amount = Number(amount);
    if (description !== undefined) data.description = description;
    if (date) data.date = new Date(date);
    const payment = await prisma.clientCarPayment.update({
      where: { id: Number(req.params.id) },
      data,
      include,
    });
    res.json(serialize(payment));
  })
);

// DELETE /api/payments/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.clientCarPayment.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

export default router;
