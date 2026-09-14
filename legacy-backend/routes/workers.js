import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";

const router = express.Router();

const include = {
  role: true,
  advances: { orderBy: { date: "desc" } },
  absences: { orderBy: { date: "desc" } },
  payments: { orderBy: { date: "desc" } },
};

function serialize(w) {
  if (!w) return w;
  const out = { ...w };
  if (out.role) out.role = { ...out.role, permissions: parsePerms(out.role.permissions) };
  return out;
}
function parsePerms(p) {
  if (typeof p !== "string") return p || {};
  try {
    return JSON.parse(p);
  } catch {
    return {};
  }
}

// --- Roles (must come before /:id) ---

// GET /api/workers/roles
router.get(
  "/roles",
  asyncHandler(async (req, res) => {
    const roles = await prisma.workerRole.findMany({ orderBy: { createdAt: "desc" } });
    res.json(roles.map((r) => ({ ...r, permissions: parsePerms(r.permissions) })));
  })
);

// POST /api/workers/roles
router.post(
  "/roles",
  asyncHandler(async (req, res) => {
    const { name, permissions } = req.body;
    if (!name) return res.status(400).json({ error: "Nom du rôle requis" });
    const role = await prisma.workerRole.create({
      data: { name, permissions: JSON.stringify(permissions || {}) },
    });
    res.status(201).json({ ...role, permissions: parsePerms(role.permissions) });
  })
);

// --- Workers ---

// GET /api/workers
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workers = await prisma.worker.findMany({ include, orderBy: { createdAt: "desc" } });
    res.json(workers.map(serialize));
  })
);

// GET /api/workers/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: Number(req.params.id) }, include });
    if (!worker) return res.status(404).json({ error: "Employé introuvable" });
    res.json(serialize(worker));
  })
);

// POST /api/workers
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      fullName, birthday, idCardNumber, phone, roleId, paymentType, paymentAmount,
      accountEnabled, email, username, password, startDate,
    } = req.body;
    if (!fullName || !phone) {
      return res.status(400).json({ error: "Nom complet et téléphone requis" });
    }

    const worker = await prisma.worker.create({
      data: {
        fullName,
        birthday: birthday ? new Date(birthday) : null,
        idCardNumber: idCardNumber || null,
        phone,
        roleId: roleId ? Number(roleId) : null,
        paymentType: paymentType || "NONE",
        paymentAmount: paymentAmount ? Number(paymentAmount) : null,
        accountEnabled: !!accountEnabled,
        email: email || null,
        username: username || null,
        startDate: startDate ? new Date(startDate) : new Date(),
      },
      include,
    });

    // Optionally create a linked user account
    if (accountEnabled && email && username && password) {
      const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
      if (!exists) {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.create({
          data: { fullName, username, email, passwordHash, role: "WORKER", workerId: worker.id },
        });
      }
    }

    res.status(201).json(serialize(worker));
  })
);

// PUT /api/workers/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const {
      fullName, birthday, idCardNumber, phone, roleId, paymentType, paymentAmount,
      accountEnabled, email, username, startDate,
    } = req.body;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null;
    if (idCardNumber !== undefined) data.idCardNumber = idCardNumber;
    if (phone !== undefined) data.phone = phone;
    if (roleId !== undefined) data.roleId = roleId ? Number(roleId) : null;
    if (paymentType !== undefined) data.paymentType = paymentType;
    if (paymentAmount !== undefined) data.paymentAmount = paymentAmount ? Number(paymentAmount) : null;
    if (accountEnabled !== undefined) data.accountEnabled = !!accountEnabled;
    if (email !== undefined) data.email = email;
    if (username !== undefined) data.username = username;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : new Date();

    const worker = await prisma.worker.update({
      where: { id: Number(req.params.id) },
      data,
      include,
    });
    res.json(serialize(worker));
  })
);

// DELETE /api/workers/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.user.deleteMany({ where: { workerId: id } });
    await prisma.worker.delete({ where: { id } });
    res.json({ ok: true });
  })
);

// PUT /api/workers/:id/permissions
router.put(
  "/:id/permissions",
  asyncHandler(async (req, res) => {
    const { permissions } = req.body;
    const worker = await prisma.worker.findUnique({ where: { id: Number(req.params.id) }, include });
    if (!worker) return res.status(404).json({ error: "Employé introuvable" });

    if (worker.roleId) {
      await prisma.workerRole.update({
        where: { id: worker.roleId },
        data: { permissions: JSON.stringify(permissions || {}) },
      });
    } else {
      // create a personal role
      const role = await prisma.workerRole.create({
        data: { name: `${worker.fullName} (perso)`, permissions: JSON.stringify(permissions || {}) },
      });
      await prisma.worker.update({ where: { id: worker.id }, data: { roleId: role.id } });
    }
    const updated = await prisma.worker.findUnique({ where: { id: worker.id }, include });
    res.json(serialize(updated));
  })
);

// POST /api/workers/:id/advances
router.post(
  "/:id/advances",
  asyncHandler(async (req, res) => {
    const { amount, date, description } = req.body;
    const adv = await prisma.workerAdvance.create({
      data: {
        workerId: Number(req.params.id),
        amount: Number(amount) || 0,
        date: date ? new Date(date) : new Date(),
        description: description || "",
      },
    });
    res.status(201).json(adv);
  })
);

// PUT /api/workers/advances/:id
router.put(
  "/advances/:id",
  asyncHandler(async (req, res) => {
    const { amount, date, description } = req.body;
    const adv = await prisma.workerAdvance.update({
      where: { id: Number(req.params.id) },
      data: {
        amount: Number(amount) || 0,
        date: date ? new Date(date) : new Date(),
        description: description || null,
      },
    });
    res.json(adv);
  })
);

// DELETE /api/workers/advances/:id
router.delete(
  "/advances/:id",
  asyncHandler(async (req, res) => {
    await prisma.workerAdvance.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

// POST /api/workers/:id/absences
router.post(
  "/:id/absences",
  asyncHandler(async (req, res) => {
    const { date, description, cost } = req.body;
    const abs = await prisma.workerAbsence.create({
      data: {
        workerId: Number(req.params.id),
        date: date ? new Date(date) : new Date(),
        description: description || null,
        cost: Number(cost) || 0,
      },
    });
    res.status(201).json(abs);
  })
);

// PUT /api/workers/absences/:id
router.put(
  "/absences/:id",
  asyncHandler(async (req, res) => {
    const { date, description, cost } = req.body;
    const abs = await prisma.workerAbsence.update({
      where: { id: Number(req.params.id) },
      data: {
        date: date ? new Date(date) : new Date(),
        description: description || null,
        cost: Number(cost) || 0,
      },
    });
    res.json(abs);
  })
);

// DELETE /api/workers/absences/:id
router.delete(
  "/absences/:id",
  asyncHandler(async (req, res) => {
    await prisma.workerAbsence.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  })
);

// POST /api/workers/:id/payments
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const { amount, month, date, description } = req.body;
    const pay = await prisma.workerPayment.create({
      data: {
        workerId: Number(req.params.id),
        amount: Number(amount) || 0,
        month: month || null,
        date: date ? new Date(date) : new Date(),
        description: description || null,
      },
    });

    const paymentDate = date ? new Date(date) : new Date();
    await prisma.workerAdvance.updateMany({
      where: { workerId: Number(req.params.id), isPaid: false, date: { lte: paymentDate } },
      data: { isPaid: true, paidAt: paymentDate, paymentId: pay.id },
    });
    await prisma.workerAbsence.updateMany({
      where: { workerId: Number(req.params.id), isPaid: false, date: { lte: paymentDate } },
      data: { isPaid: true, paidAt: paymentDate, paymentId: pay.id },
    });

    res.status(201).json(pay);
  })
);

export default router;
