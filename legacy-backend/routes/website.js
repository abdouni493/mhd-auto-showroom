import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { serializeCar } from "../lib/serialize.js";

const router = express.Router();

async function getContacts() {
  let c = await prisma.websiteContact.findFirst();
  if (!c) c = await prisma.websiteContact.create({ data: {} });
  return c;
}

// ---------- PUBLIC ----------

// GET /api/website/offers  — available, not hidden cars (with selling price from purchase)
router.get(
  "/offers",
  asyncHandler(async (req, res) => {
    const cars = await prisma.car.findMany({
      where: { status: "AVAILABLE", websiteOffer: { is: { hidden: false } } },
      include: { websiteOffer: true, purchase: true },
      orderBy: { createdAt: "desc" },
    });
    // also include cars that have no offer row yet (default visible)
    const carsNoOffer = await prisma.car.findMany({
      where: { status: "AVAILABLE", websiteOffer: null },
      include: { websiteOffer: true, purchase: true },
      orderBy: { createdAt: "desc" },
    });
    const all = [...cars, ...carsNoOffer].map((c) => ({
      ...serializeCar(c),
      price: c.purchase?.sellingPrice || 0,
    }));
    res.json(all);
  })
);

// GET /api/website/special-offers  — active special offers
router.get(
  "/special-offers",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const offers = await prisma.websiteOffer.findMany({
      where: { isSpecial: true, hidden: false },
      include: { car: { include: { purchase: true } } },
      orderBy: { createdAt: "desc" },
    });
    const active = offers
      .filter((o) => (!o.startDate || o.startDate <= now) && (!o.endDate || o.endDate >= now))
      .map((o) => ({
        ...o,
        car: serializeCar(o.car),
        oldPrice: o.car.purchase?.sellingPrice || 0,
      }));
    res.json(active);
  })
);

// GET /api/website/contacts
router.get(
  "/contacts",
  asyncHandler(async (req, res) => {
    res.json(await getContacts());
  })
);

// POST /api/website/reservations  — public reservation request
router.post(
  "/reservations",
  asyncHandler(async (req, res) => {
    const { carId, clientName, clientPhone } = req.body;
    if (!carId || !clientName || !clientPhone) {
      return res.status(400).json({ error: "Véhicule, nom et téléphone requis" });
    }
    const reservation = await prisma.websiteReservation.create({
      data: { carId: Number(carId), clientName, clientPhone, status: "PENDING" },
    });
    res.status(201).json(reservation);
  })
);

// ---------- PROTECTED ----------

// PUT /api/website/contacts
router.put(
  "/contacts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const c = await getContacts();
    const { facebook, instagram, tiktok, maps, whatsapp } = req.body;
    const updated = await prisma.websiteContact.update({
      where: { id: c.id },
      data: { facebook, instagram, tiktok, maps, whatsapp },
    });
    res.json(updated);
  })
);

// GET /api/website/reservations
router.get(
  "/reservations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reservations = await prisma.websiteReservation.findMany({
      include: { car: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(reservations.map((r) => ({ ...r, car: serializeCar(r.car) })));
  })
);

// PATCH /api/website/reservations/:id/status
router.patch(
  "/reservations/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const id = Number(req.params.id);
    const reservation = await prisma.websiteReservation.update({
      where: { id },
      data: { status },
    });
    // accepting reserves the car
    if (status === "ACCEPTED") {
      await prisma.car.update({ where: { id: reservation.carId }, data: { status: "RESERVED" } }).catch(() => {});
    }
    res.json(reservation);
  })
);

// GET /api/website/admin/offers  — all available cars w/ offer visibility (protected)
router.get(
  "/admin/offers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const cars = await prisma.car.findMany({
      where: { status: "AVAILABLE" },
      include: { websiteOffer: true, purchase: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      cars.map((c) => ({
        ...serializeCar(c),
        price: c.purchase?.sellingPrice || 0,
        hidden: c.websiteOffer?.hidden || false,
      }))
    );
  })
);

// GET /api/website/admin/special-offers  — all special offers (protected)
router.get(
  "/admin/special-offers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const offers = await prisma.websiteOffer.findMany({
      where: { isSpecial: true },
      include: { car: { include: { purchase: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      offers.map((o) => ({
        ...o,
        car: serializeCar(o.car),
        oldPrice: o.car.purchase?.sellingPrice || 0,
      }))
    );
  })
);

// PUT /api/website/offers/:carId/visibility
router.put(
  "/offers/:carId/visibility",
  requireAuth,
  asyncHandler(async (req, res) => {
    const carId = Number(req.params.carId);
    const { hidden } = req.body;
    const offer = await prisma.websiteOffer.upsert({
      where: { carId },
      update: { hidden: !!hidden },
      create: { carId, hidden: !!hidden },
    });
    res.json(offer);
  })
);

// POST /api/website/special-offers
router.post(
  "/special-offers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { carId, specialPrice, startDate, endDate } = req.body;
    if (!carId || !specialPrice) {
      return res.status(400).json({ error: "Véhicule et prix spécial requis" });
    }
    const offer = await prisma.websiteOffer.upsert({
      where: { carId: Number(carId) },
      update: {
        isSpecial: true,
        specialPrice: Number(specialPrice),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        hidden: false,
      },
      create: {
        carId: Number(carId),
        isSpecial: true,
        specialPrice: Number(specialPrice),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json(offer);
  })
);

// DELETE /api/website/special-offers/:id
router.delete(
  "/special-offers/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.websiteOffer.update({
      where: { id },
      data: { isSpecial: false, specialPrice: null, startDate: null, endDate: null },
    });
    res.json({ ok: true });
  })
);

export default router;
