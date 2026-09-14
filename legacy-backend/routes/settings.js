import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = express.Router();

async function getShowroom() {
  let showroom = await prisma.showroom.findFirst();
  if (!showroom) {
    showroom = await prisma.showroom.create({ data: { name: "Mon Showroom" } });
  }
  return showroom;
}

// GET /api/settings/public  — public showroom identity (name, logo, description, contacts)
router.get(
  "/public",
  asyncHandler(async (req, res) => {
    const s = await getShowroom();
    res.json({
      name: s.name,
      logo: s.logo,
      description: s.description,
      email: s.email,
      phone: s.phone,
      address: s.address,
    });
  })
);

// GET /api/settings  — full settings (protected)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await getShowroom();
    res.json(s);
  })
);

// PUT /api/settings  — update (protected)
router.put(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const s = await getShowroom();
    const { name, logo, description, email, phone, address, nif, nis, article, rc } = req.body;
    const updated = await prisma.showroom.update({
      where: { id: s.id },
      data: { name, logo, description, email, phone, address, nif, nis, article, rc },
    });
    res.json(updated);
  })
);

// --- Database backup / restore ---

// GET /api/settings/backup  — export all data as JSON
router.get(
  "/backup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = {
      exportedAt: new Date().toISOString(),
      showroom: await prisma.showroom.findMany(),
      users: await prisma.user.findMany(),
      workers: await prisma.worker.findMany(),
      workerRoles: await prisma.workerRole.findMany(),
      suppliers: await prisma.supplier.findMany(),
      clients: await prisma.client.findMany(),
      cars: await prisma.car.findMany(),
      purchases: await prisma.purchase.findMany(),
      purchasePayments: await prisma.purchasePayment.findMany(),
      sales: await prisma.sale.findMany(),
      salePayments: await prisma.salePayment.findMany(),
      clientCarPayments: await prisma.clientCarPayment.findMany(),
      expenses: await prisma.expense.findMany(),
      workerPayments: await prisma.workerPayment.findMany(),
      workerAdvances: await prisma.workerAdvance.findMany(),
      workerAbsences: await prisma.workerAbsence.findMany(),
      websiteOffers: await prisma.websiteOffer.findMany(),
      websiteReservations: await prisma.websiteReservation.findMany(),
      websiteContacts: await prisma.websiteContact.findMany(),
    };
    res.json(data);
  })
);

export default router;
