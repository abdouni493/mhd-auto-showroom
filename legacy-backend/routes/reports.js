import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

// GET /api/reports?from=&to=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to + "T23:59:59");
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const [sales, purchases, expenses, workers] = await Promise.all([
      prisma.sale.findMany({ where, include: { car: true, client: true }, orderBy: { date: "desc" } }),
      prisma.purchase.findMany({ where, include: { car: true, supplier: true, client: true }, orderBy: { date: "desc" } }),
      prisma.expense.findMany({ where, include: { car: true }, orderBy: { date: "desc" } }),
      prisma.worker.findMany({
        include: {
          payments: { where: Object.keys(dateFilter).length ? { date: dateFilter } : {} },
          advances: { where: Object.keys(dateFilter).length ? { date: dateFilter } : {} },
          absences: { where: Object.keys(dateFilter).length ? { date: dateFilter } : {} },
          role: true,
        },
      }),
    ]);

    const carExpenses = expenses.filter((e) => e.type === "CAR");
    const showroomExpenses = expenses.filter((e) => e.type === "SHOWROOM");

    // Synthese
    const totalSalesCount = sales.length;
    const totalSalesAmount = sales.reduce((a, s) => a + s.totalAfterReduction, 0);
    const totalPurchaseCount = purchases.length;
    const totalPurchaseAmount = purchases.reduce((a, p) => a + p.purchasePrice, 0);
    const totalCarExpenses = carExpenses.reduce((a, e) => a + e.amount, 0);
    const totalShowroomExpenses = showroomExpenses.reduce((a, e) => a + e.amount, 0);
    const grossProfit = totalSalesAmount - totalPurchaseAmount;
    const netProfit = grossProfit - totalCarExpenses - totalShowroomExpenses;

    // Per-car analysis
    const carIds = new Set();
    sales.forEach((s) => carIds.add(s.carId));
    purchases.forEach((p) => carIds.add(p.carId));
    carExpenses.forEach((e) => e.carId && carIds.add(e.carId));

    const carAnalysis = [];
    for (const carId of carIds) {
      const car = await prisma.car.findUnique({
        where: { id: carId },
        include: { purchase: true, sales: true, expenses: true },
      });
      if (!car) continue;
      const purchasePrice = car.purchase?.purchasePrice || 0;
      const carExp = car.expenses.filter((e) => e.type === "CAR").reduce((a, e) => a + e.amount, 0);
      const salePrice = car.sales.reduce((a, s) => a + s.totalAfterReduction, 0);
      const totalCost = purchasePrice + carExp;
      const grossMargin = salePrice - purchasePrice;
      const netMargin = salePrice - totalCost;
      const netMarginPct = salePrice ? (netMargin / salePrice) * 100 : 0;
      carAnalysis.push({
        car: serializeCar({ ...car, purchase: undefined, sales: undefined, expenses: undefined }),
        purchasePrice,
        expenses: carExp,
        totalCost,
        salePrice,
        grossMargin,
        netMargin,
        netMarginPct: Math.round(netMarginPct * 10) / 10,
        expenseList: car.expenses.filter((e) => e.type === "CAR"),
      });
    }

    // debts
    const clientDebts = sales.filter((s) => s.amountRest > 0).map((s) => ({
      client: s.client,
      car: serializeCar(s.car),
      total: s.totalAfterReduction,
      paid: s.amountPaid,
      rest: s.amountRest,
      date: s.date,
    }));
    const supplierDebts = purchases.filter((p) => p.amountRest > 0).map((p) => ({
      source: p.sourceType === "SUPPLIER" ? p.supplier?.fullName : (p.client ? `${p.client.firstName} ${p.client.lastName}` : "—"),
      sourceType: p.sourceType,
      car: serializeCar(p.car),
      total: p.purchasePrice,
      paid: p.amountPaid,
      rest: p.amountRest,
      date: p.date,
    }));

    // worker payroll
    const payroll = workers.map((w) => {
      const totalAdvances = w.advances.reduce((a, x) => a + x.amount, 0);
      const totalAbsences = w.absences.reduce((a, x) => a + x.cost, 0);
      const netPaid = w.payments.reduce((a, x) => a + x.amount, 0);
      return {
        fullName: w.fullName,
        role: w.role?.name || "—",
        baseSalary: w.paymentAmount || 0,
        paymentType: w.paymentType,
        advances: totalAdvances,
        absences: totalAbsences,
        netPaid,
      };
    });

    // client-sourced car sales
    const clientSourcedPurchases = purchases.filter((p) => p.sourceType === "CLIENT").map((p) => ({
      source: p.client ? `${p.client.firstName} ${p.client.lastName}` : "—",
      car: serializeCar(p.car),
      total: p.purchasePrice,
      paid: p.amountPaid,
      rest: p.amountRest,
      date: p.date,
    }));

    res.json({
      synthese: {
        totalSalesCount, totalSalesAmount,
        totalPurchaseCount, totalPurchaseAmount,
        totalCarExpenses, totalShowroomExpenses,
        grossProfit, netProfit,
      },
      sales: sales.map((s) => ({ ...s, car: serializeCar(s.car) })),
      purchases: purchases.map((p) => ({ ...p, car: serializeCar(p.car) })),
      carAnalysis,
      showroomExpenses,
      clientDebts,
      supplierDebts,
      payroll,
      clientSourcedPurchases,
    });
  })
);

export default router;
