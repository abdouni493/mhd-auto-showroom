import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeSale, makeReference } from "../lib/serialize.js";

const router = express.Router();

const include = {
  car: true,
  client: true,
  payments: { orderBy: { date: "desc" } },
};

// Compute totals from pricing inputs
function computeTotals({ basePrice, tvaEnabled, tvaRate, reductionType, reductionValue }) {
  const base = Number(basePrice) || 0;
  const totalBeforeTax = base;
  let totalAfterTax = base;
  if (tvaEnabled && tvaRate) {
    totalAfterTax = base * (1 + Number(tvaRate) / 100);
  }
  let totalAfterReduction = totalAfterTax;
  if (reductionType === "PERCENT" && reductionValue) {
    totalAfterReduction = totalAfterTax * (1 - Number(reductionValue) / 100);
  } else if (reductionType === "FIXED" && reductionValue) {
    totalAfterReduction = Math.max(0, totalAfterTax - Number(reductionValue));
  }
  return {
    totalBeforeTax: round(totalBeforeTax),
    totalAfterTax: round(totalAfterTax),
    totalAfterReduction: round(totalAfterReduction),
  };
}

const round = (n) => Math.round(n * 100) / 100;

const dateFields = ["birthDate", "docDeliveryDate", "docExpiry"];
function buildClientData(c) {
  const data = { ...c };
  for (const f of dateFields) {
    if (data[f]) data[f] = new Date(data[f]);
    else delete data[f];
  }
  delete data.id;
  delete data.stats;
  delete data.createdAt;
  return data;
}

// GET /api/sales
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { saleType, paid, search, from, to } = req.query;
    const where = {};
    if (saleType) where.saleType = saleType;
    if (paid === "PAID") where.amountRest = { lte: 0 };
    if (paid === "DEBT") where.amountRest = { gt: 0 };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + "T23:59:59");
    }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { client: { firstName: { contains: search } } },
        { client: { lastName: { contains: search } } },
        { client: { phonePrimary: { contains: search } } },
        { car: { brand: { contains: search } } },
        { car: { model: { contains: search } } },
      ];
    }
    const sales = await prisma.sale.findMany({ where, include, orderBy: { date: "desc" } });
    res.json(sales.map(serializeSale));
  })
);

// GET /api/sales/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findUnique({ where: { id: Number(req.params.id) }, include });
    if (!sale) return res.status(404).json({ error: "Vente introuvable" });
    res.json(serializeSale(sale));
  })
);

// POST /api/sales — finalize a sale
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      carId,
      clientId,
      client, // new client object (optional)
      saleType = "NORMAL",
      basePrice = 0,
      tvaEnabled = false,
      tvaRate,
      reductionType = "NONE",
      reductionValue,
      amountPaid = 0,
      clientTakeCar = true,
      inspection = {},
      date,
    } = req.body;

    if (!carId) return res.status(400).json({ error: "Véhicule requis" });

    const totals = computeTotals({ basePrice, tvaEnabled, tvaRate, reductionType, reductionValue });
    const paid = Number(amountPaid) || 0;
    const rest = Math.max(0, totals.totalAfterReduction - paid);

    const result = await prisma.$transaction(async (tx) => {
      // resolve client
      let resolvedClientId = clientId ? Number(clientId) : null;
      if (!resolvedClientId && client) {
        const created = await tx.client.create({ data: buildClientData(client) });
        resolvedClientId = created.id;
      }
      if (!resolvedClientId) {
        throw Object.assign(new Error("Client requis"), { status: 400 });
      }

      const sale = await tx.sale.create({
        data: {
          carId: Number(carId),
          clientId: resolvedClientId,
          saleType,
          tvaEnabled: !!tvaEnabled,
          tvaRate: tvaEnabled ? Number(tvaRate) || 0 : null,
          reductionType,
          reductionValue: reductionType !== "NONE" ? Number(reductionValue) || 0 : null,
          totalBeforeTax: totals.totalBeforeTax,
          totalAfterTax: totals.totalAfterTax,
          totalAfterReduction: totals.totalAfterReduction,
          amountPaid: paid,
          amountRest: rest,
          clientTakeCar: !!clientTakeCar,
          date: date ? new Date(date) : new Date(),
          inspection: JSON.stringify(inspection || {}),
        },
      });

      const reference = makeReference("VNT", sale.id);
      await tx.sale.update({ where: { id: sale.id }, data: { reference } });

      if (paid > 0) {
        await tx.salePayment.create({
          data: { saleId: sale.id, amount: paid, description: "Acompte initial", date: date ? new Date(date) : new Date() },
        });
      }

      // update car status
      await tx.car.update({
        where: { id: Number(carId) },
        data: { status: saleType === "DEPOSIT" ? "RESERVED" : "SOLD" },
      });

      return tx.sale.findUnique({ where: { id: sale.id }, include });
    });

    res.status(201).json(serializeSale(result));
  })
);

// PUT /api/sales/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.sale.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Vente introuvable" });

    const {
      saleType, basePrice, tvaEnabled, tvaRate, reductionType, reductionValue,
      amountPaid, clientTakeCar, inspection, date,
    } = req.body;

    const totals = computeTotals({
      basePrice: basePrice !== undefined ? basePrice : existing.totalBeforeTax,
      tvaEnabled: tvaEnabled !== undefined ? tvaEnabled : existing.tvaEnabled,
      tvaRate: tvaRate !== undefined ? tvaRate : existing.tvaRate,
      reductionType: reductionType !== undefined ? reductionType : existing.reductionType,
      reductionValue: reductionValue !== undefined ? reductionValue : existing.reductionValue,
    });
    const paid = amountPaid !== undefined ? Number(amountPaid) : existing.amountPaid;
    const rest = Math.max(0, totals.totalAfterReduction - paid);

    await prisma.sale.update({
      where: { id },
      data: {
        saleType: saleType || existing.saleType,
        tvaEnabled: tvaEnabled !== undefined ? !!tvaEnabled : existing.tvaEnabled,
        tvaRate: tvaEnabled ? Number(tvaRate) || 0 : existing.tvaRate,
        reductionType: reductionType || existing.reductionType,
        reductionValue: reductionValue !== undefined ? Number(reductionValue) : existing.reductionValue,
        ...totals,
        amountPaid: paid,
        amountRest: rest,
        clientTakeCar: clientTakeCar !== undefined ? !!clientTakeCar : existing.clientTakeCar,
        inspection: inspection !== undefined ? JSON.stringify(inspection) : existing.inspection,
        date: date ? new Date(date) : existing.date,
      },
    });
    if (saleType) {
      await prisma.car.update({
        where: { id: existing.carId },
        data: { status: saleType === "DEPOSIT" ? "RESERVED" : "SOLD" },
      });
    }
    const updated = await prisma.sale.findUnique({ where: { id }, include });
    res.json(serializeSale(updated));
  })
);

// DELETE /api/sales/:id  (frees the car back to AVAILABLE)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: "Vente introuvable" });
    await prisma.$transaction(async (tx) => {
      await tx.sale.delete({ where: { id } });
      await tx.car.update({ where: { id: sale.carId }, data: { status: "AVAILABLE" } }).catch(() => {});
    });
    res.json({ ok: true });
  })
);

// POST /api/sales/:id/payments  — pay debt
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { amount, description, date } = req.body;
    const amt = Number(amount) || 0;
    if (amt <= 0) return res.status(400).json({ error: "Montant invalide" });

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: "Vente introuvable" });

    const newPaid = sale.amountPaid + amt;
    const newRest = Math.max(0, sale.totalAfterReduction - newPaid);

    await prisma.$transaction([
      prisma.salePayment.create({
        data: { saleId: id, amount: amt, description: description || "Règlement", date: date ? new Date(date) : new Date() },
      }),
      prisma.sale.update({ where: { id }, data: { amountPaid: newPaid, amountRest: newRest } }),
    ]);

    const updated = await prisma.sale.findUnique({ where: { id }, include });
    res.json(serializeSale(updated));
  })
);

export default router;
