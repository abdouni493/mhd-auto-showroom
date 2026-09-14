import express from "express";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/dashboard/stats
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      carsInStock, carsSoldMonth, carsReserved,
      salesMonth, allSales, allPurchases, expensesMonth,
      workers, workerPaymentsMonth, advances,
      pendingReservations, hiddenOffers,
      lastPurchases, lastSales, lastExpenses, allCars,
    ] = await Promise.all([
      prisma.car.count({ where: { status: "AVAILABLE" } }),
      prisma.car.count({ where: { status: "SOLD", sales: { some: { date: { gte: monthStart } } } } }),
      prisma.car.count({ where: { status: "RESERVED" } }),
      prisma.sale.findMany({ where: { date: { gte: monthStart } } }),
      prisma.sale.findMany(),
      prisma.purchase.findMany(),
      prisma.expense.findMany({ where: { date: { gte: monthStart } } }),
      prisma.worker.findMany(),
      prisma.workerPayment.findMany({ where: { date: { gte: monthStart } } }),
      prisma.workerAdvance.findMany(),
      prisma.websiteReservation.count({ where: { status: "PENDING" } }),
      prisma.websiteOffer.count({ where: { hidden: true } }),
      prisma.purchase.findMany({ take: 5, orderBy: { date: "desc" }, include: { car: true, supplier: true, client: true } }),
      prisma.sale.findMany({ take: 5, orderBy: { date: "desc" }, include: { car: true, client: true } }),
      prisma.expense.findMany({ take: 5, orderBy: { date: "desc" }, include: { car: true } }),
      prisma.car.findMany(),
    ]);

    const caMonth = salesMonth.reduce((a, s) => a + s.totalAfterReduction, 0);
    const clientDebts = allSales.reduce((a, s) => a + s.amountRest, 0);
    const supplierDebts = allPurchases.reduce((a, p) => a + p.amountRest, 0);
    const expensesMonthTotal = expensesMonth.reduce((a, e) => a + e.amount, 0);
    const allExpenses = await prisma.expense.findMany();
    const totalExpensesAll = allExpenses.reduce((a, e) => a + e.amount, 0);
    const totalSalesAll = allSales.reduce((a, s) => a + s.totalAfterReduction, 0);
    const totalPurchaseAll = allPurchases.reduce((a, p) => a + p.purchasePrice, 0);
    const netProfit = totalSalesAll - totalPurchaseAll - totalExpensesAll;

    // monthly series last 12 months
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), sales: 0, revenue: 0, expenses: 0, profit: 0 });
    }
    const mIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const s of allSales) {
      const k = monthKey(new Date(s.date));
      if (k in mIndex) {
        months[mIndex[k]].sales += 1;
        months[mIndex[k]].revenue += s.totalAfterReduction;
      }
    }
    for (const e of allExpenses) {
      const k = monthKey(new Date(e.date));
      if (k in mIndex) months[mIndex[k]].expenses += e.amount;
    }
    for (const m of months) m.profit = m.revenue - m.expenses;

    const payrollMonth = workerPaymentsMonth.reduce((a, p) => a + p.amount, 0);
    const pendingAdvances = advances.reduce((a, x) => a + x.amount, 0);

    const statusDistribution = {
      AVAILABLE: allCars.filter((c) => c.status === "AVAILABLE").length,
      SOLD: allCars.filter((c) => c.status === "SOLD").length,
      RESERVED: allCars.filter((c) => c.status === "RESERVED").length,
    };

    res.json({
      kpis: {
        carsInStock,
        carsSoldMonth,
        carsReserved,
        caMonth,
        clientDebts,
        supplierDebts,
        expensesMonth: expensesMonthTotal,
        netProfit,
      },
      charts: { months, statusDistribution },
      lists: {
        lastPurchases: lastPurchases.map((p) => ({ ...p, car: serializeCar(p.car) })),
        lastSales: lastSales.map((s) => ({ ...s, car: serializeCar(s.car) })),
        lastExpenses: lastExpenses.map((e) => ({ ...e, car: e.car ? serializeCar(e.car) : null })),
      },
      workers: {
        count: workers.length,
        payrollMonth,
        pendingAdvances,
      },
      website: {
        pendingReservations,
        hiddenOffers,
      },
    });
  })
);

export default router;
