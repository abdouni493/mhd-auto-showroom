import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { uploadDir } from "./middleware/upload.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import settingsRoutes from "./routes/settings.js";
import carsRoutes from "./routes/cars.js";
import suppliersRoutes from "./routes/suppliers.js";
import clientsRoutes from "./routes/clients.js";
import purchasesRoutes from "./routes/purchases.js";
import salesRoutes from "./routes/sales.js";
import paymentsRoutes from "./routes/payments.js";
import workersRoutes from "./routes/workers.js";
import expensesRoutes from "./routes/expenses.js";
import reportsRoutes from "./routes/reports.js";
import websiteRoutes from "./routes/website.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes from "./routes/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static serving of uploaded images
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Public routes (no auth)
app.use("/api/auth", authRoutes);
app.use("/api/website", websiteRoutes); // contains its own public/protected split

// Public showroom info endpoint
app.use("/api/settings", settingsRoutes); // GET /showroom-public is public inside

// Protected routes
app.use("/api/cars", requireAuth, carsRoutes);
app.use("/api/suppliers", requireAuth, suppliersRoutes);
app.use("/api/clients", requireAuth, clientsRoutes);
app.use("/api/purchases", requireAuth, purchasesRoutes);
app.use("/api/sales", requireAuth, salesRoutes);
app.use("/api/payments", requireAuth, paymentsRoutes);
app.use("/api/workers", requireAuth, workersRoutes);
app.use("/api/expenses", requireAuth, expensesRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/upload", requireAuth, uploadRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚗 Showroom API running on http://localhost:${PORT}\n`);
});
