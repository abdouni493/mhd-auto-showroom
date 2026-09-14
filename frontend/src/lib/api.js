import { supabase, uploadFile, toCamel, BUCKETS, createIsolatedClient } from "./supabase.js";

// ── Reads come back snake_case from PostgREST; the whole app expects camelCase.
//    `toCamel` converts globally; the small `shape*` helpers below fix the few
//    relations that don't map 1:1 (embedded documents, singular purchase, …). ──

function shapeCar(car) {
  if (!car) return car;
  // car_documents relation -> documents:[{ type, url }] (what the UI expects)
  if (Array.isArray(car.carDocuments)) {
    car.documents = car.carDocuments.map((d) => ({ ...d, type: d.type, url: d.docUrl }));
    delete car.carDocuments;
  } else if (!Array.isArray(car.documents)) {
    car.documents = [];
  }
  // purchases[] -> purchase (singular) — components read car.purchase.sellingPrice
  if (Array.isArray(car.purchases)) {
    car.purchase = car.purchases[0] || null;
  }
  return car;
}

function shapePurchase(p) {
  if (!p) return p;
  if (p.client) shapeClient(p.client);
  if (p.car) {
    shapeCar(p.car);
    // inspection is stored on the car; the printed invoice reads purchase.inspection
    if (p.inspection == null) p.inspection = p.car.inspection || {};
  }
  return p;
}

function shapeSale(s) {
  if (!s) return s;
  if (s.car) shapeCar(s.car);
  // clients embed as photo_url; the forms and invoices read client.photo
  if (s.client) shapeClient(s.client);
  // totalAfterTax isn't a column — derive it for the printed invoice
  const base = Number(s.totalBeforeTax) || 0;
  s.totalAfterTax = s.tvaEnabled ? Math.round(base * (1 + (Number(s.tvaRate) || 0) / 100)) : base;

  // Derive purchase price, car expenses, total cost & gain for this sale
  const purchaseObj = s.car?.purchase || (Array.isArray(s.car?.purchases) ? s.car.purchases[0] : null);
  const purchasePrice = Number(purchaseObj?.purchasePrice || purchaseObj?.purchase_price || 0);
  const carExpensesList = Array.isArray(s.car?.expenses)
    ? s.car.expenses.filter((e) => e.type === "CAR" || !e.type)
    : [];
  const carExpenses = carExpensesList.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const totalCost = purchasePrice + carExpenses;
  const salePrice = Number(s.totalAfterReduction) || 0;

  // A "client car" (Prestation / Dépôt client) belongs to its owner: the gain of
  // the showroom is its share, not the difference with a purchase price.
  s.sourceType = purchaseObj?.sourceType || purchaseObj?.source_type || null;
  s.isClientCar = s.sourceType === "CLIENT";
  s.showroomShare = Number(s.showroomShare) || 0;

  s.purchasePrice = purchasePrice;
  s.carExpenses = carExpenses;
  s.totalCost = totalCost;
  if (s.isClientCar) {
    // showroom result = its share minus what it spent on the vehicle
    s.hasPurchaseInfo = true;
    s.gain = s.showroomShare - carExpenses;
    s.ownerAmount = salePrice - s.showroomShare - carExpenses;
  } else {
    s.hasPurchaseInfo = purchasePrice > 0 || carExpenses > 0;
    s.gain = s.hasPurchaseInfo ? salePrice - totalCost : 0;
  }

  return s;
}

function rows(data) {
  return (data || []).map(toCamel);
}

// Selects (relations aliased so toCamel + shapers produce the expected shape)
const CAR_FULL = `
  *,
  car_documents(*),
  expenses(*),
  purchases(*, client:clients(*), purchase_payments(*)),
  sales(*, client:clients(*), payments:sale_payments(*))
`;
const PURCHASE_FULL = `
  *,
  car:cars(*, car_documents(*)),
  client:clients(*),
  purchase_payments(*)
`;
const SALE_FULL = `
  *,
  car:cars(*, car_documents(*), purchases(*), expenses(*)),
  client:clients(*),
  payments:sale_payments(*)
`;
const PAYMENT_FULL = `
  *,
  car:cars(*, car_documents(*)),
  sale:sales(client:clients(*))
`;

// ── AUTH ──────────────────────────────────────────────────────
// Build the in-app user from the Supabase auth user. Determines whether the
// account is an admin (row in `users`) or a worker (row in `workers` linked by
// auth_id) and attaches the permission map used to gate the UI.
async function mergeProfile(authUser) {
  if (!authUser) return null;

  // 1. Admin?  (own row is readable via the "users: own row" RLS policy)
  const { data: adminRow } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (adminRow && adminRow.role === "admin") {
    return {
      id: authUser.id,
      authId: authUser.id,
      email: authUser.email || adminRow.email || "",
      fullName: adminRow.full_name || "",
      username: adminRow.username || "",
      role: "admin",
      isAdmin: true,
      permissions: null, // admin: full access
    };
  }

  // 2. Worker?  (their role carries the permission map)
  const { data: workerRow } = await supabase
    .from("workers")
    .select("*, role:worker_roles(*)")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (workerRow) {
    return {
      id: authUser.id,
      authId: authUser.id,
      email: authUser.email || workerRow.email || "",
      fullName: workerRow.full_name || "",
      username: workerRow.username || "",
      role: workerRow.role?.name || "worker",
      isAdmin: false,
      permissions: workerRow.role?.permissions || {},
    };
  }

  // 3. Authenticated but no profile yet (e.g. admin whose row is still being
  //    created). Treat as admin — only admins ever self-register here.
  return {
    id: authUser.id,
    authId: authUser.id,
    email: authUser.email || "",
    fullName: authUser.user_metadata?.full_name || "",
    username: authUser.user_metadata?.username || "",
    role: "admin",
    isAdmin: true,
    permissions: null,
  };
}

export const auth = {
  // Used by the login page to show the "Créer un compte administrateur" button
  // only while the showroom has no administrator yet.
  async adminExists() {
    const { data, error } = await supabase.rpc("admin_exists");
    if (error) return true; // fail closed: never offer registration on an error
    return !!data;
  },
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const m = (error.message || "").toLowerCase();
      // Make the most common production cause actionable: the account simply
      // doesn't exist in Supabase yet (e.g. an old local/demo account).
      if (m.includes("invalid login credentials")) {
        throw new Error(
          "Email ou mot de passe incorrect. Si vous n'avez pas encore de compte Supabase, créez un compte administrateur ci-dessous."
        );
      }
      if (m.includes("email not confirmed")) {
        throw new Error(
          "Email non confirmé. Désactivez « Confirm email » dans Supabase (Authentication → Providers → Email), puis réessayez."
        );
      }
      throw error;
    }
    return mergeProfile(data.user);
  },
  async register({ fullName, username, email, password }) {
    // The metadata lets the optional `handle_new_user` DB trigger create the admin
    // profile row server-side (works even with email confirmation / RLS).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { kind: "admin", full_name: fullName, username } },
    });
    if (error) throw error;

    // Projects with "Confirm email" enabled don't return a session from signUp.
    // Without a session every RLS-protected query fails, so make sure we have one
    // (or surface a clear, actionable message instead of a broken logged-in state).
    let session = data.session;
    if (!session) {
      const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
      session = signIn?.session || null;
    }
    if (!session) {
      throw new Error(
        "Compte créé. Confirmez votre adresse email pour vous connecter — ou désactivez « Confirm email » dans Supabase (Authentication → Providers → Email)."
      );
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      // Backup of the trigger: create the profile row client-side too (idempotent).
      await supabase
        .from("users")
        .upsert({ auth_id: user.id, full_name: fullName, username, email, role: "admin" }, { onConflict: "auth_id" });
    }
    return { id: user?.id, authId: user?.id, email, fullName, username, role: "admin", isAdmin: true, permissions: null };
  },
  async logout() {
    await supabase.auth.signOut();
  },
  // Re-verify the CURRENT user's password (used to unlock sensitive screens like
  // the Caisse). Runs on an isolated client so a successful sign-in does NOT
  // replace / refresh the admin's live session. Returns true / false.
  async verifyPassword(password) {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    if (!email || !password) return false;
    const tmp = createIsolatedClient();
    const { error } = await tmp.auth.signInWithPassword({ email, password });
    return !error;
  },
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return mergeProfile(data.user);
  },
  async updateProfile({ fullName, username, email, password }) {
    const authPatch = {};
    if (email) authPatch.email = email;
    if (password) authPatch.password = password;
    if (Object.keys(authPatch).length) {
      const { error } = await supabase.auth.updateUser(authPatch);
      if (error) throw error;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      await supabase
        .from("users")
        .upsert(
          { auth_id: authData.user.id, full_name: fullName, username, email: email || authData.user.email },
          { onConflict: "auth_id" }
        );
    }
    return mergeProfile(authData?.user);
  },
};

// ── SETTINGS ─────────────────────────────────────────────────
async function getSettingsRow() {
  const { data } = await supabase.from("settings").select("*").order("id").limit(1).maybeSingle();
  return data;
}
function shapeSettings(row) {
  if (!row) return row;
  const s = toCamel(row);
  s.logo = s.logoUrl ?? null; // existing components read settings.logo
  return s;
}

export const settingsApi = {
  async get() {
    return shapeSettings(await getSettingsRow());
  },
  async update(payload) {
    const row = await getSettingsRow();
    const patch = {
      name: payload.name,
      description: payload.description,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      nif: payload.nif,
      nis: payload.nis,
      article: payload.article,
      rc: payload.rc,
    };
    if (payload.logo !== undefined || payload.logoUrl !== undefined) {
      patch.logo_url = payload.logo ?? payload.logoUrl ?? null;
    }
    const q = row?.id
      ? supabase.from("settings").update(patch).eq("id", row.id)
      : supabase.from("settings").insert(patch);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return shapeSettings(data);
  },
  async uploadLogo(file) {
    const ext = file.name.split(".").pop();
    return uploadFile(BUCKETS.showroomLogo, `logo-${Date.now()}.${ext}`, file);
  },
  // Export the main tables as a JSON object (Database tab → Backup).
  async backup() {
    const tables = [
      "settings", "users", "workers", "worker_roles", "clients",
      "cars", "car_colors", "car_years", "car_documents", "purchases",
      "purchase_payments", "sales",
      "sale_payments", "expenses", "worker_payments", "worker_advances",
      "worker_absences", "special_offers", "website_reservations",
    ];
    const out = { exportedAt: new Date().toISOString() };
    await Promise.all(
      tables.map(async (t) => {
        const { data } = await supabase.from(t).select("*");
        out[t] = data || [];
      })
    );
    return out;
  },
};

// ── INSPECTION TEMPLATE ──────────────────────────────────────
// The reusable checklist (master list of items shown on every new purchase /
// sale) is persisted in settings.inspection_template (JSONB). When a user adds
// or removes an item it is saved here so it reappears on the next purchase and
// the next sale. Template items are stored all-active; the per-vehicle active
// toggles live on each car/sale's own `inspection` snapshot, not here.
function normalizeTemplate(tpl) {
  const out = {};
  for (const k of ["security", "equipment", "comfort"]) {
    out[k] = (tpl?.[k] || [])
      .filter((it) => it && it.label)
      .map((it) => ({ label: it.label, active: true }));
  }
  return out;
}

const INSPECTION_LS_KEY = "showroom-inspection-template";
function hasItems(tpl) {
  return !!(tpl && (tpl.security?.length || tpl.equipment?.length || tpl.comfort?.length));
}

export const inspectionApi = {
  // Returns the saved template, or null when none is stored yet. Reads the
  // database first; if the column hasn't been added (or the read fails) it falls
  // back to a localStorage copy so added items still survive a page refresh.
  // Callers fall back to the in-code DEFAULT_INSPECTION when this returns null.
  async getTemplate() {
    try {
      const row = await getSettingsRow();
      if (hasItems(row?.inspection_template)) return row.inspection_template;
    } catch {
      /* column missing / read failed — try the local fallback below */
    }
    try {
      const cached = JSON.parse(localStorage.getItem(INSPECTION_LS_KEY) || "null");
      if (hasItems(cached)) return cached;
    } catch {
      /* ignore malformed cache */
    }
    return null;
  },
  async saveTemplate(template) {
    const norm = normalizeTemplate(template);
    // Always keep a local copy so it survives a refresh even before the DB
    // migration (schema-fix.sql) has been applied.
    try { localStorage.setItem(INSPECTION_LS_KEY, JSON.stringify(norm)); } catch { /* ignore */ }
    try {
      const row = await getSettingsRow();
      const q = row?.id
        ? supabase.from("settings").update({ inspection_template: norm }).eq("id", row.id)
        : supabase.from("settings").insert({ inspection_template: norm });
      const { error } = await q;
      if (error) throw error;
    } catch {
      /* column not added yet — the localStorage copy above still persists it */
    }
    return norm;
  },
};

// ── CARS ─────────────────────────────────────────────────────
function carInsert(car) {
  return {
    brand: car.brand,
    model: car.model,
    plate: car.plate,
    year: car.year ? Number(car.year) : null,
    color: car.color,
    energy: car.energy || "ESSENCE",
    gearbox: car.gearbox || "MANUAL",
    seats: car.seats ? Number(car.seats) : null,
    mileage: car.mileage ? Number(car.mileage) : null,
    vin: car.vin,
    keys_count: car.keysCount === "" || car.keysCount == null ? null : Number(car.keysCount),
    fiche: car.fiche,
    specs: car.specs ?? {},
    images: car.images || [],
    inspection: car.inspection ?? {},
  };
}

export const carsApi = {
  async list({ status = "", search = "" } = {}) {
    let q = supabase.from("cars").select(CAR_FULL).order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`brand.ilike.%${search}%,model.ilike.%${search}%,plate.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    const all = rows(data).map(shapeCar);
    // Hide orphaned cars (AVAILABLE with no purchase record)
    return all.filter((c) => {
      if (c.status !== "AVAILABLE") return true; // SOLD / RESERVED are always shown
      return Array.isArray(c.purchases) ? c.purchases.length > 0 : !!c.purchase;
    });
  },
  async listAvailable() {
    const { data, error } = await supabase
      .from("cars")
      .select(CAR_FULL)
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const all = rows(data).map(shapeCar);
    // Filter out orphaned cars (no purchase record) — they shouldn't appear in POS
    return all.filter((c) => Array.isArray(c.purchases) ? c.purchases.length > 0 : !!c.purchase);
  },
  async get(id) {
    const { data, error } = await supabase.from("cars").select(CAR_FULL).eq("id", id).single();
    if (error) throw error;
    return shapeCar(toCamel(data));
  },
  async create(payload) {
    const { data, error } = await supabase.from("cars").insert(carInsert(payload)).select().single();
    if (error) throw error;
    return shapeCar(toCamel(data));
  },
  async update(id, payload) {
    const patch = {};
    const map = {
      brand: "brand", model: "model", plate: "plate", year: "year", color: "color",
      energy: "energy", gearbox: "gearbox", seats: "seats", mileage: "mileage", vin: "vin",
      keysCount: "keys_count", fiche: "fiche", specs: "specs", images: "images",
      inspection: "inspection", status: "status", hidden: "hidden", price: "price",
    };
    for (const [camel, snake] of Object.entries(map)) {
      if (payload[camel] !== undefined) patch[snake] = payload[camel];
    }
    const { data, error } = await supabase.from("cars").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return shapeCar(toCamel(data));
  },
  async delete(id) {
    const { error } = await supabase.from("cars").delete().eq("id", id);
    if (error) throw error;
  },
  async uploadImages(carId, files) {
    const urls = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${carId}/${crypto.randomUUID()}.${ext}`;
      urls.push(await uploadFile(BUCKETS.carImages, path, file));
    }
    return urls;
  },
  async uploadDocument(carId, file) {
    const ext = file.name.split(".").pop();
    const path = `${carId || "new"}/${crypto.randomUUID()}.${ext}`;
    return uploadFile(BUCKETS.carDocuments, path, file);
  },
  async getDocumentTypes() {
    const { data } = await supabase.from("car_document_types").select("*").order("name");
    return rows(data);
  },
  async createDocumentType(name) {
    const { data, error } = await supabase.from("car_document_types").insert({ name }).select().single();
    if (error) throw error;
    return toCamel(data);
  },

  // ── Colours & years ──────────────────────────────────────────
  // Reference lists behind the two pickers of the purchase form. Creating an
  // entry that already exists returns the existing row instead of failing on
  // the UNIQUE constraint, so a double click never shows an error.
  async getColors() {
    const { data, error } = await supabase.from("car_colors").select("*").order("name");
    if (error) throw error;
    return rows(data);
  },
  async createColor(name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Nom de couleur vide");
    const { data, error } = await supabase.from("car_colors").insert({ name: clean }).select().single();
    if (error) {
      if (error.code === "23505") {
        const { data: found } = await supabase.from("car_colors").select("*").ilike("name", clean).limit(1);
        if (found?.length) return toCamel(found[0]);
      }
      throw error;
    }
    return toCamel(data);
  },
  // Removing a colour only shrinks the picker list: cars keep the colour text
  // that was saved on them, since cars.color is plain text, not a reference.
  // RLS silently deletes nothing when the account lacks the right, so the
  // deleted row is read back to turn that into a real error.
  async deleteColor(id) {
    const { data, error } = await supabase.from("car_colors").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Suppression refusée : permission insuffisante");
    return true;
  },
  async getYears() {
    const { data, error } = await supabase.from("car_years").select("*").order("year", { ascending: false });
    if (error) throw error;
    return rows(data);
  },
  async createYear(year) {
    const value = Number(year);
    if (!Number.isInteger(value) || value < 1900 || value > 2100) throw new Error("Année invalide");
    const { data, error } = await supabase.from("car_years").insert({ year: value }).select().single();
    if (error) {
      if (error.code === "23505") {
        const { data: found } = await supabase.from("car_years").select("*").eq("year", value).limit(1);
        if (found?.length) return toCamel(found[0]);
      }
      throw error;
    }
    return toCamel(data);
  },
  // Remove orphaned car records (AVAILABLE with no purchase) left behind
  // by previous purchase deletions that failed to clean up the car.
  async cleanupOrphaned() {
    const { data: cars, error } = await supabase
      .from("cars")
      .select("id, purchases(id)")
      .eq("status", "AVAILABLE");
    if (error) throw error;
    const orphaned = (cars || []).filter((c) => !c.purchases || c.purchases.length === 0);
    let deleted = 0;
    for (const c of orphaned) {
      const { error: delErr } = await supabase.from("cars").delete().eq("id", c.id);
      if (!delErr) deleted++;
    }
    return deleted;
  },
};

// ── PURCHASES ─────────────────────────────────────────────────
async function getPurchaseFull(id) {
  const { data } = await supabase.from("purchases").select(PURCHASE_FULL).eq("id", id).single();
  return shapePurchase(toCamel(data));
}

export const purchasesApi = {
  async list({ sourceType = "", paid = "", search = "" } = {}) {
    let q = supabase.from("purchases").select(PURCHASE_FULL).order("created_at", { ascending: false });
    if (sourceType) q = q.eq("source_type", sourceType);
    const { data, error } = await q;
    if (error) throw error;
    let result = rows(data).map(shapePurchase);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p) =>
        `${p.car?.brand || ""} ${p.car?.model || ""} ${p.car?.plate || ""}`.toLowerCase().includes(s)
      );
    }
    if (paid === "PAID") return result.filter((p) => p.amountRest <= 0);
    if (paid === "DEBT") return result.filter((p) => p.amountRest > 0);
    return result;
  },
  async create({
    sourceType, clientId, car, purchasePrice, sellingPrice, amountPaid,
    inspection, date, documents = [], receivedAt, receivedBy, receivedPhone, remark,
  }) {
    // 1. create the car (images/docs are already-uploaded URLs)
    const { data: carRow, error: carError } = await supabase
      .from("cars")
      .insert({ ...carInsert(car), inspection: inspection ?? car.inspection ?? {} })
      .select()
      .single();
    if (carError) throw carError;

    // 2. car documents (each: { type, url })
    const docs = documents.length ? documents : car.documents || [];
    if (docs.length > 0) {
      const { error: docError } = await supabase
        .from("car_documents")
        .insert(docs.map((d) => ({ car_id: carRow.id, type: d.type, doc_url: d.url || "" })));
      if (docError) throw docError;
    }

    // 3. the purchase
    // A vehicle bought by the showroom owner himself has no counterparty and no
    // debt: what it cost is what was paid.
    const price = Number(purchasePrice) || 0;
    const paid = sourceType === "SHOWROOM" ? price : Number(amountPaid) || 0;

    const { data: purchase, error: purError } = await supabase
      .from("purchases")
      .insert({
        car_id: carRow.id,
        source_type: sourceType,
        client_id: sourceType === "CLIENT" ? clientId || null : null,
        purchase_price: price,
        selling_price: Number(sellingPrice) || 0,
        amount_paid: paid,
        received_at: receivedAt || date || null,
        received_by: receivedBy || null,
        received_phone: receivedPhone || null,
        remark: remark || null,
        date,
      })
      .select()
      .single();
    if (purError) throw purError;

    return getPurchaseFull(purchase.id); // enriched (joins) so the invoice can print
  },
  async update(id, {
    sourceType, clientId, car, purchasePrice, sellingPrice, amountPaid,
    inspection, date, receivedAt, receivedBy, receivedPhone, remark,
  }) {
    const { data: existing, error: exError } = await supabase
      .from("purchases")
      .select("car_id, source_type, client_id, purchase_price, selling_price, amount_paid, date, received_at")
      .eq("id", id)
      .single();
    if (exError) throw exError;
    const carId = existing.car_id;

    // 1. car fields (only when the form actually sent a car)
    if (car && carId) {
      const { error: carError } = await supabase
        .from("cars")
        .update({ ...carInsert(car), inspection: inspection ?? car.inspection ?? {} })
        .eq("id", carId);
      if (carError) throw carError;

      // 2. documents — replace the full set (each: { type, url }, url may be null).
      //    Skipped when `documents` is absent so a partial payload can't wipe them.
      if (Array.isArray(car.documents)) {
        const { error: delDocError } = await supabase.from("car_documents").delete().eq("car_id", carId);
        if (delDocError) throw delDocError;
        if (car.documents.length > 0) {
          const { error: docError } = await supabase
            .from("car_documents")
            .insert(car.documents.map((d) => ({ car_id: carId, type: d.type, doc_url: d.url || "" })));
          if (docError) throw docError;
        }
      }
    }

    // 3. the purchase — a showroom purchase must clear client_id, otherwise the
    //    old owner stays attached after switching source.
    const source = sourceType ?? existing.source_type;
    const price = Number(purchasePrice ?? existing.purchase_price) || 0;
    const paid = source === "SHOWROOM" ? price : Number(amountPaid ?? existing.amount_paid) || 0;
    const patch = {
      source_type: source,
      client_id: source === "CLIENT" ? clientId || null : null,
      purchase_price: price,
      selling_price: Number(sellingPrice ?? existing.selling_price) || 0,
      amount_paid: paid,
      date: date || existing.date,
    };
    if (receivedAt !== undefined) patch.received_at = receivedAt || null;
    if (receivedBy !== undefined) patch.received_by = receivedBy || null;
    if (receivedPhone !== undefined) patch.received_phone = receivedPhone || null;
    if (remark !== undefined) patch.remark = remark || null;

    const { error: purError } = await supabase.from("purchases").update(patch).eq("id", id);
    if (purError) throw purError;

    return getPurchaseFull(id);
  },
  async delete(id) {
    const { data: purchase } = await supabase.from("purchases").select("car_id").eq("id", id).single();
    const carId = purchase?.car_id;

    if (carId) {
      // Deleting the car cascades to delete the purchase (ON DELETE CASCADE),
      // car_documents, sales, special_offers, and website_reservations.
      const { error: carErr } = await supabase.from("cars").delete().eq("id", carId);
      if (carErr) {
        // Fallback: delete the purchase first, then retry car deletion
        const { error: purErr } = await supabase.from("purchases").delete().eq("id", id);
        if (purErr) throw purErr;
        const { error: carErr2 } = await supabase.from("cars").delete().eq("id", carId);
        if (carErr2) console.warn("Could not delete orphaned car", carId, carErr2.message);
      }
    } else {
      // No car linked — just delete the purchase
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    }
  },
  async addPayment(purchaseId, amount) {
    const { error } = await supabase
      .from("purchase_payments")
      .insert({ purchase_id: purchaseId, amount: Number(amount), date: new Date().toISOString() });
    if (error) throw error;
  },
};

// ── SALES ─────────────────────────────────────────────────────
function computeSaleTotal({ basePrice, tvaEnabled, tvaRate, reductionType, reductionValue }) {
  const base = Number(basePrice) || 0;
  const afterTax = tvaEnabled ? base * (1 + (Number(tvaRate) || 0) / 100) : base;
  let total = afterTax;
  if (reductionType === "PERCENT") total = afterTax * (1 - (Number(reductionValue) || 0) / 100);
  else if (reductionType === "FIXED") total = Math.max(0, afterTax - (Number(reductionValue) || 0));
  return Math.round(total);
}
// Make SUM(sale_payments) match the amount the user typed, by adjusting only
// the "Versement initial" row (created / deleted as needed).
async function reconcileInitialPayment(saleId, carId, target) {
  const { data: payments } = await supabase
    .from("sale_payments")
    .select("id, amount, is_initial")
    .eq("sale_id", saleId);
  const list = payments || [];
  const initial = list.find((p) => p.is_initial);
  const others = list
    .filter((p) => !p.is_initial)
    .reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const wanted = Math.max(0, target - others);

  if (wanted === 0) {
    if (initial) await supabase.from("sale_payments").delete().eq("id", initial.id);
    return;
  }
  if (initial) {
    await supabase.from("sale_payments").update({ amount: wanted }).eq("id", initial.id);
  } else {
    await supabase.from("sale_payments").insert({
      sale_id: saleId, car_id: carId, amount: wanted, is_initial: true,
      date: new Date().toISOString(), description: "Versement initial",
    });
  }
}

async function getSaleFull(id) {
  const { data } = await supabase.from("sales").select(SALE_FULL).eq("id", id).single();
  return shapeSale(toCamel(data));
}

export const salesApi = {
  async list({ saleType = "", paid = "", search = "" } = {}) {
    let q = supabase.from("sales").select(SALE_FULL).order("created_at", { ascending: false });
    if (saleType) q = q.eq("sale_type", saleType);
    const { data, error } = await q;
    if (error) throw error;
    let result = rows(data).map(shapeSale);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.client?.firstName?.toLowerCase().includes(s) ||
          r.client?.lastName?.toLowerCase().includes(s) ||
          r.client?.phonePrimary?.includes(s) ||
          r.reference?.toLowerCase().includes(s)
      );
    }
    if (paid === "PAID") return result.filter((r) => r.amountRest <= 0);
    if (paid === "DEBT") return result.filter((r) => r.amountRest > 0);
    return result;
  },
  async create(payload) {
    const total = computeSaleTotal(payload);

    // create the client if a new one was entered
    let clientId = payload.clientId;
    if (!clientId && payload.client) {
      const c = payload.client;
      const { data: cl, error: clErr } = await supabase
        .from("clients")
        .insert({
          first_name: c.firstName,
          last_name: c.lastName,
          phone_primary: c.phonePrimary,
          phone_secondary: c.phoneSecondary,
          email: c.email,
          address: c.address,
          profession: c.profession,
          birth_date: c.birthDate || null,
          birth_place: c.birthPlace,
          gender: c.gender || null,
          photo_url: c.photo,
          doc_type: c.docType,
          doc_number: c.docNumber,
          doc_delivery_date: c.docDeliveryDate || null,
          doc_expiry: c.docExpiry || null,
          doc_delivery_address: c.docDeliveryAddress,
          nif: c.nif,
          rc: c.rc,
        })
        .select()
        .single();
      if (clErr) throw clErr;
      clientId = cl?.id;
    }

    const { data, error } = await supabase
      .from("sales")
      .insert({
        car_id: payload.carId,
        client_id: clientId,
        sale_type: payload.saleType,
        total_before_tax: Number(payload.basePrice) || 0,
        tva_enabled: !!payload.tvaEnabled,
        tva_rate: payload.tvaRate ? Number(payload.tvaRate) : 0,
        stamp_enabled: !!payload.stampEnabled,
        stamp_rate: payload.stampRate ? Number(payload.stampRate) : 2,
        reduction_type: payload.reductionType || "NONE",
        reduction_value: payload.reductionValue ? Number(payload.reductionValue) : 0,
        total_after_reduction: total,
        amount_paid: Number(payload.amountPaid) || 0,
        // Part kept by the showroom when the vehicle belongs to a client
        showroom_share: Number(payload.showroomShare) || 0,
        payment_method: payload.paymentMethod || null,
        client_take_car: payload.clientTakeCar !== false,
        inspection: payload.inspection ?? {},
        date: payload.date,
      })
      .select()
      .single();
    if (error) throw error;
    return getSaleFull(data.id);
  },
  // Full update — the Sales edit form sends every field the POS creation flow
  // collects (client, inspection, pricing, date, clientTakeCar). Fields that
  // are left out keep their stored value, and the total is always recomputed
  // from the merged values so a partial payload can never zero it out.
  async update(id, payload) {
    const { data: existing, error: exError } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .single();
    if (exError) throw exError;

    const pick = (key, column) => (payload[key] !== undefined ? payload[key] : existing[column]);
    const merged = {
      basePrice: pick("basePrice", "total_before_tax"),
      tvaEnabled: pick("tvaEnabled", "tva_enabled"),
      tvaRate: pick("tvaRate", "tva_rate"),
      reductionType: pick("reductionType", "reduction_type"),
      reductionValue: pick("reductionValue", "reduction_value"),
    };

    const patch = {
      sale_type: pick("saleType", "sale_type"),
      total_before_tax: Number(merged.basePrice) || 0,
      tva_enabled: !!merged.tvaEnabled,
      tva_rate: Number(merged.tvaRate) || 0,
      reduction_type: merged.reductionType || "NONE",
      reduction_value: Number(merged.reductionValue) || 0,
      total_after_reduction: computeSaleTotal(merged),
    };
    if (payload.amountPaid !== undefined) patch.amount_paid = Number(payload.amountPaid) || 0;
    if (payload.showroomShare !== undefined) patch.showroom_share = Number(payload.showroomShare) || 0;
    if (payload.stampEnabled !== undefined) patch.stamp_enabled = !!payload.stampEnabled;
    if (payload.stampRate !== undefined) patch.stamp_rate = Number(payload.stampRate) || 0;
    if (payload.paymentMethod !== undefined) patch.payment_method = payload.paymentMethod || null;
    if (payload.clientTakeCar !== undefined) patch.client_take_car = !!payload.clientTakeCar;
    if (payload.clientId !== undefined) patch.client_id = payload.clientId || null;
    if (payload.inspection !== undefined) patch.inspection = payload.inspection ?? {};
    if (payload.date) patch.date = payload.date;

    const { data, error } = await supabase.from("sales").update(patch).eq("id", id).select().single();
    if (error) throw error;

    // `amount_paid` is rebuilt from sale_payments by a trigger. Correcting the
    // amount from the edit form therefore means correcting the initial payment
    // row, keeping the later règlements untouched.
    if (payload.amountPaid !== undefined) {
      await reconcileInitialPayment(id, existing.car_id, Number(payload.amountPaid) || 0);
    }

    // The car-status trigger only fires on INSERT, so mirror it on update:
    // taking the car marks it SOLD, a deposit leaves it RESERVED.
    if (payload.clientTakeCar !== undefined && existing.car_id) {
      const { error: carError } = await supabase
        .from("cars")
        .update({ status: payload.clientTakeCar ? "SOLD" : "RESERVED" })
        .eq("id", existing.car_id);
      if (carError) throw carError;
    }

    return getSaleFull(data.id);
  },
  async delete(id) {
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) throw error;
  },
  async addPayment(saleId, carId, amount, description) {
    const { error } = await supabase
      .from("sale_payments")
      .insert({ sale_id: saleId, car_id: carId, amount: Number(amount), description, date: new Date().toISOString() });
    if (error) throw error;
  },
};

// ── CLIENTS ───────────────────────────────────────────────────
function shapeClient(c) {
  if (!c) return c;
  c.photo = c.photoUrl ?? null; // components read client.photo
  return c;
}
function clientWrite(p) {
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    phone_primary: p.phonePrimary,
    phone_secondary: p.phoneSecondary,
    email: p.email,
    address: p.address,
    profession: p.profession,
    birth_date: p.birthDate || null,
    birth_place: p.birthPlace,
    gender: p.gender || null,
    doc_type: p.docType,
    doc_number: p.docNumber,
    doc_delivery_date: p.docDeliveryDate || null,
    doc_expiry: p.docExpiry || null,
    doc_delivery_address: p.docDeliveryAddress,
    nif: p.nif,
    rc: p.rc,
    photo_url: p.photo ?? p.photoUrl ?? null,
  };
}

export const clientsApi = {
  async list() {
    const { data, error } = await supabase
      .from("clients")
      .select("*, purchases(id, source_type), sales(id, amount_rest)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows(data).map((c) => {
      shapeClient(c);
      const deposits = (c.purchases || []).filter((p) => p.sourceType === "CLIENT");
      c.stats = {
        totalPurchases: c.purchases?.length || 0,
        totalSales: c.sales?.length || 0,
        saleRest: (c.sales || []).reduce((a, s) => a + (s.amountRest > 0 ? s.amountRest : 0), 0),
        depositCars: deposits.length,
      };
      // Owners of deposited vehicles are the only clients that can be settled.
      c.hasDepositCars = deposits.length > 0;
      return c;
    });
  },
  async search(query) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_primary.ilike.%${query}%`)
      .limit(15);
    if (error) throw error;
    return rows(data).map(shapeClient);
  },
  async create(payload) {
    const { data, error } = await supabase.from("clients").insert(clientWrite(payload)).select().single();
    if (error) throw error;
    return shapeClient(toCamel(data));
  },
  async update(id, payload) {
    const { data, error } = await supabase.from("clients").update(clientWrite(payload)).eq("id", id).select().single();
    if (error) throw error;
    return shapeClient(toCamel(data));
  },
  async delete(id) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },
  async history(id) {
    const { data: salesData } = await supabase
      .from("sales")
      .select("*, car:cars(*, car_documents(*)), payments:sale_payments(*)")
      .eq("client_id", id);
    const { data: purchasesData } = await supabase
      .from("purchases")
      .select("*, car:cars(*, car_documents(*))")
      .eq("client_id", id);
    const { data: settlementsData } = await supabase
      .from("client_settlements")
      .select(SETTLEMENT_FULL)
      .eq("client_id", id)
      .order("date", { ascending: false });
    const sales = rows(salesData).map(shapeSale);
    const purchases = rows(purchasesData).map(shapePurchase);
    const settlements = rows(settlementsData).map(shapeSettlement);
    return {
      sales,
      purchases,
      settlements,
      stats: {
        totalSaleAmount: sales.reduce((a, s) => a + (s.totalAfterReduction || 0), 0),
        totalPurchaseAmount: purchases.reduce((a, p) => a + (p.purchasePrice || 0), 0),
        totalPaid: sales.reduce((a, s) => a + (s.amountPaid || 0), 0),
        totalRest: sales.reduce((a, s) => a + (s.amountRest || 0), 0),
        totalSettled: settlements.reduce((a, x) => a + (x.ownerAmount || 0), 0),
      },
    };
  },
  async uploadPhoto(clientId, file) {
    const ext = file.name.split(".").pop();
    const path = `${clientId || "new"}/${crypto.randomUUID()}.${ext}`;
    return uploadFile(BUCKETS.clientPhotos, path, file);
  },
};


// ── CLIENT SETTLEMENTS (Règlements propriétaires) ─────────────────────────
// A vehicle deposited by a client ("Prestation / Dépôt client") that has been
// sold owes its owner:
//     prix de vente − part du showroom − dépenses engagées sur le véhicule
// Until that règlement is created, an alert is raised on the dashboard, on the
// sidebar Clients entry and on the Clients page.
const SETTLEMENT_FULL = `
  *,
  client:clients(*),
  car:cars(*, car_documents(*)),
  sale:sales(*),
  purchase:purchases(*)
`;

function shapeSettlement(st) {
  if (!st) return st;
  if (st.client) shapeClient(st.client);
  if (st.car) shapeCar(st.car);
  return st;
}

const carExpensesOf = (car) =>
  (car?.expenses || []).filter((e) => e.type === "CAR" || !e.type);

export const settlementsApi = {
  // Every sale of a client-owned vehicle that has not been settled yet.
  async pending() {
    const [{ data: salesData, error }, { data: done }] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "*, car:cars(*, car_documents(*), expenses(*), purchases(*, client:clients(*))), client:clients(*)"
        )
        .order("date", { ascending: false }),
      supabase.from("client_settlements").select("sale_id"),
    ]);
    if (error) throw error;
    const settled = new Set((done || []).map((r) => r.sale_id));

    return rows(salesData)
      .map(shapeSale)
      .filter((sale) => !settled.has(sale.id))
      .map((sale) => {
        const purchase = sale.car?.purchase || (sale.car?.purchases || [])[0] || null;
        if (!purchase || purchase.sourceType !== "CLIENT" || !purchase.clientId) return null;
        const expenses = carExpensesOf(sale.car);
        const expensesTotal = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
        const salePrice = Number(sale.totalAfterReduction) || 0;
        const showroomShare = Number(sale.showroomShare) || 0;
        return {
          saleId: sale.id,
          sale,
          purchaseId: purchase.id,
          purchase,
          clientId: purchase.clientId,
          client: purchase.client ? shapeClient({ ...purchase.client }) : null,
          carId: sale.carId,
          car: sale.car,
          salePrice,
          showroomShare,
          expenses,
          expensesTotal,
          ownerAmount: salePrice - showroomShare - expensesTotal,
          date: sale.date,
        };
      })
      .filter(Boolean);
  },

  async pendingCount() {
    return (await settlementsApi.pending()).length;
  },

  // Pending règlements grouped by owner — used by the Clients page badges.
  async pendingByClient() {
    const list = await settlementsApi.pending();
    const map = {};
    for (const p of list) (map[p.clientId] ||= []).push(p);
    return map;
  },

  async list({ clientId = "" } = {}) {
    let q = supabase.from("client_settlements").select(SETTLEMENT_FULL).order("date", { ascending: false });
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) throw error;
    return rows(data).map(shapeSettlement);
  },

  async get(id) {
    const { data, error } = await supabase.from("client_settlements").select(SETTLEMENT_FULL).eq("id", id).single();
    if (error) throw error;
    return shapeSettlement(toCamel(data));
  },

  async create(payload) {
    const { data, error } = await supabase
      .from("client_settlements")
      .insert({
        client_id: payload.clientId,
        car_id: payload.carId || null,
        sale_id: payload.saleId || null,
        purchase_id: payload.purchaseId || null,
        sale_price: Number(payload.salePrice) || 0,
        showroom_share: Number(payload.showroomShare) || 0,
        expenses_total: Number(payload.expensesTotal) || 0,
        owner_amount: Number(payload.ownerAmount) || 0,
        // snapshot: the receipt must keep printing the same list later on
        expenses: (payload.expenses || []).map((e) => ({
          name: e.name, description: e.description, amount: Number(e.amount) || 0, date: e.date,
        })),
        payment_method: payload.paymentMethod || null,
        note: payload.note || null,
        status: "SETTLED",
        date: payload.date || new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return settlementsApi.get(data.id);
  },

  async delete(id) {
    const { error } = await supabase.from("client_settlements").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── WORKERS ───────────────────────────────────────────────────
// Provision a login for a worker. Uses an isolated client so creating the account
// does NOT replace the admin's current session.
async function createWorkerAuthAccount(email, password, fullName, username) {
  const tmp = createIsolatedClient();
  const { data, error } = await tmp.auth.signUp({
    email,
    password,
    options: { data: { kind: "worker", full_name: fullName, username } },
  });
  if (error) {
    if (/registered|already|exists/i.test(error.message)) {
      throw new Error("Un compte de connexion avec cet email existe déjà.");
    }
    throw new Error("Impossible de créer le compte de connexion : " + error.message);
  }
  return data.user?.id || null;
}

async function markWorkerItemsAsPaid(workerId, paymentId, paymentDate) {
  const [advanceRes, absenceRes] = await Promise.all([
    supabase
      .from("worker_advances")
      .update({ is_paid: true, paid_at: paymentDate, payment_id: paymentId })
      .eq("worker_id", workerId)
      .is("is_paid", false)
      .lte("date", paymentDate),
    supabase
      .from("worker_absences")
      .update({ is_paid: true, paid_at: paymentDate, payment_id: paymentId })
      .eq("worker_id", workerId)
      .is("is_paid", false)
      .lte("date", paymentDate),
  ]);

  if (advanceRes.error) throw advanceRes.error;
  if (absenceRes.error) throw absenceRes.error;
}

export const workersApi = {
  async list() {
    const { data } = await supabase
      .from("workers")
      .select(
        "*, role:worker_roles(*), advances:worker_advances(*), absences:worker_absences(*), payments:worker_payments(*)"
      )
      .order("created_at", { ascending: false });
    return rows(data);
  },
  async create(payload) {
    let authId = null;
    if (payload.accountEnabled && payload.email && payload.password) {
      authId = await createWorkerAuthAccount(payload.email, payload.password, payload.fullName, payload.username);
    }
    const { data, error } = await supabase
      .from("workers")
      .insert({
        full_name: payload.fullName,
        phone: payload.phone,
        birthday: payload.birthday || null,
        id_card_number: payload.idCardNumber,
        role_id: payload.roleId || null,
        payment_type: payload.paymentType || "NONE",
        payment_amount: Number(payload.paymentAmount) || 0,
        start_date: payload.startDate || null,
        account_enabled: !!payload.accountEnabled,
        auth_id: authId,
        email: payload.email,
        username: payload.username,
      })
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async update(id, payload) {
    const patch = {
      full_name: payload.fullName,
      phone: payload.phone,
      birthday: payload.birthday || null,
      id_card_number: payload.idCardNumber,
      role_id: payload.roleId || null,
      payment_type: payload.paymentType || "NONE",
      payment_amount: Number(payload.paymentAmount) || 0,
      start_date: payload.startDate || null,
      account_enabled: !!payload.accountEnabled,
    };
    // If a login is being enabled for the first time, provision the auth account.
    if (payload.accountEnabled && payload.email && payload.password) {
      const { data: existing } = await supabase.from("workers").select("auth_id").eq("id", id).single();
      if (!existing?.auth_id) {
        patch.auth_id = await createWorkerAuthAccount(payload.email, payload.password, payload.fullName, payload.username);
        patch.email = payload.email;
        patch.username = payload.username;
      }
    }
    const { data, error } = await supabase.from("workers").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return toCamel(data);
  },
  async delete(id) {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) throw error;
  },
  async updatePermissions(workerId, permissions) {
    const { data: worker } = await supabase.from("workers").select("role_id").eq("id", workerId).single();
    if (worker?.role_id) {
      await supabase.from("worker_roles").update({ permissions }).eq("id", worker.role_id);
    }
  },
  async addAdvance(workerId, payload) {
    const { error } = await supabase.from("worker_advances").insert({
      worker_id: workerId,
      amount: Number(payload.amount) || 0,
      date: payload.date,
      description: payload.description,
      is_paid: false,
      paid_at: null,
      payment_id: null,
    });
    if (error) throw error;
  },
  async updateAdvance(id, payload) {
    const { data, error } = await supabase
      .from("worker_advances")
      .update({
        amount: Number(payload.amount) || 0,
        date: payload.date,
        description: payload.description,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async deleteAdvance(id) {
    const { error } = await supabase.from("worker_advances").delete().eq("id", id);
    if (error) throw error;
  },
  async addAbsence(workerId, payload) {
    const { error } = await supabase.from("worker_absences").insert({
      worker_id: workerId,
      cost: Number(payload.cost) || 0,
      date: payload.date,
      description: payload.description,
      is_paid: false,
      paid_at: null,
      payment_id: null,
    });
    if (error) throw error;
  },
  async updateAbsence(id, payload) {
    const { data, error } = await supabase
      .from("worker_absences")
      .update({
        cost: Number(payload.cost) || 0,
        date: payload.date,
        description: payload.description,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async deleteAbsence(id) {
    const { error } = await supabase.from("worker_absences").delete().eq("id", id);
    if (error) throw error;
  },
  async addPayment(workerId, payload) {
    const { data, error } = await supabase
      .from("worker_payments")
      .insert({
        worker_id: workerId,
        amount: Number(payload.amount) || 0,
        date: payload.date,
        description: payload.description,
        month: payload.month,
      })
      .select("id")
      .single();
    if (error) throw error;
    await markWorkerItemsAsPaid(workerId, data.id, payload.date);
    return toCamel(data);
  },
  async listRoles() {
    const { data } = await supabase.from("worker_roles").select("*").order("name");
    return rows(data);
  },
  async createRole(name) {
    const { data, error } = await supabase.from("worker_roles").insert({ name, permissions: {} }).select().single();
    if (error) throw error;
    return toCamel(data);
  },
};

// ── EXPENSES ─────────────────────────────────────────────────
export const expensesApi = {
  async list(type = "") {
    let q = supabase
      .from("expenses")
      .select("*, car:cars(brand, model, plate, images)")
      .order("date", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) throw error;
    return rows(data);
  },
  // Expenses of a period, for the printable report. `type` empty = both kinds.
  async listRange({ from, to, type = "" } = {}) {
    let q = supabase
      .from("expenses")
      .select("*, car:cars(brand, model, plate, images)")
      .order("date", { ascending: true });
    if (type) q = q.eq("type", type);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) throw error;
    return rows(data);
  },
  async create(payload) {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        name: payload.name,
        description: payload.description,
        amount: Number(payload.amount) || 0,
        type: payload.type,
        car_id: payload.carId || null,
        date: payload.date,
      })
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async update(id, payload) {
    const { data, error } = await supabase
      .from("expenses")
      .update({
        name: payload.name,
        description: payload.description,
        amount: Number(payload.amount) || 0,
        date: payload.date,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async delete(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── CAISSE (cash register: deposits / withdrawals) ────────────
// A single table records both directions:
//   DEPOSIT    → money INTO the caisse (client name + phone + amount + description)
//   WITHDRAWAL → money OUT of the caisse (amount + description)
const CASH_FULL = `*, client:clients(*)`;

function shapeCashTx(t) {
  if (!t) return t;
  shapeClient(t.client);
  return t;
}
async function getCashTxFull(id) {
  const { data } = await supabase.from("cash_transactions").select(CASH_FULL).eq("id", id).single();
  return shapeCashTx(toCamel(data));
}

export const cashApi = {
  // type: "" (all) | "DEPOSIT" | "WITHDRAWAL"
  async list({ type = "", search = "" } = {}) {
    let q = supabase.from("cash_transactions").select(CASH_FULL).order("date", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) throw error;
    let result = rows(data).map(shapeCashTx);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.clientName?.toLowerCase().includes(s) ||
          r.clientPhone?.includes(s) ||
          r.description?.toLowerCase().includes(s) ||
          r.reference?.toLowerCase().includes(s)
      );
    }
    return result;
  },
  // Running balance across every transaction (deposits add, withdrawals subtract).
  async balance() {
    const { data, error } = await supabase.from("cash_transactions").select("type, amount");
    if (error) throw error;
    return (data || []).reduce(
      (a, r) => a + (r.type === "WITHDRAWAL" ? -1 : 1) * (Number(r.amount) || 0),
      0
    );
  },
  async create(payload) {
    const { data, error } = await supabase
      .from("cash_transactions")
      .insert({
        type: payload.type || "DEPOSIT",
        client_id: payload.clientId || null,
        client_name: payload.clientName || null,
        client_phone: payload.clientPhone || null,
        amount: Number(payload.amount) || 0,
        description: payload.description || null,
        date: payload.date || new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return getCashTxFull(data.id); // enriched so the receipt can print
  },
  async update(id, payload) {
    const patch = {};
    if (payload.clientId !== undefined) patch.client_id = payload.clientId || null;
    if (payload.clientName !== undefined) patch.client_name = payload.clientName || null;
    if (payload.clientPhone !== undefined) patch.client_phone = payload.clientPhone || null;
    if (payload.amount !== undefined) patch.amount = Number(payload.amount) || 0;
    if (payload.description !== undefined) patch.description = payload.description || null;
    if (payload.date !== undefined) patch.date = payload.date;
    const { data, error } = await supabase
      .from("cash_transactions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return getCashTxFull(data.id);
  },
  async delete(id) {
    const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── PAYMENTS (Règlements page) ────────────────────────────────
function shapePayment(p) {
  if (!p) return p;
  shapeCar(p.car);
  p.client = p.sale?.client || null; // the page reads payment.client directly
  return p;
}
async function getPaymentFull(id) {
  const { data } = await supabase.from("sale_payments").select(PAYMENT_FULL).eq("id", id).single();
  return shapePayment(toCamel(data));
}

export const paymentsApi = {
  async list(search = "") {
    const { data, error } = await supabase
      .from("sale_payments")
      .select(PAYMENT_FULL)
      .order("date", { ascending: false });
    if (error) throw error;
    let result = rows(data).map(shapePayment);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.car?.brand?.toLowerCase().includes(s) ||
          r.car?.model?.toLowerCase().includes(s) ||
          r.client?.firstName?.toLowerCase().includes(s) ||
          r.client?.lastName?.toLowerCase().includes(s)
      );
    }
    return result;
  },
  async create({ carId, amount, description, date }) {
    const { data: sale } = await supabase
      .from("sales")
      .select("id")
      .eq("car_id", carId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sale) throw new Error("Aucune vente trouvée pour ce véhicule");
    const { data, error } = await supabase
      .from("sale_payments")
      .insert({ sale_id: sale.id, car_id: carId, amount: Number(amount) || 0, description, date })
      .select()
      .single();
    if (error) throw error;
    return getPaymentFull(data.id);
  },
  async update(id, payload) {
    const { data, error } = await supabase
      .from("sale_payments")
      .update({ amount: Number(payload.amount) || 0, description: payload.description })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async delete(id) {
    const { error } = await supabase.from("sale_payments").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const dashboardApi = {
  async stats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartISO = monthStart.toISOString();
    const monthStr = monthKey(now);

    const [carsRes, salesRes, purchasesRes, expensesRes, workersRes, workerPaymentsRes, advancesRes, reservationsRes, clientsRes, pendingSettlements] =
      await Promise.all([
        supabase.from("cars").select("id, status, hidden, created_at"),
        supabase.from("sales").select("*, car:cars(brand, model, plate, images, status), client:clients(*)").order("date", { ascending: false }),
        supabase.from("purchases").select("*, car:cars(brand, model, plate, images), client:clients(*)").order("date", { ascending: false }),
        supabase.from("expenses").select("*, car:cars(brand, model, plate, images)").order("date", { ascending: false }),
        supabase.from("workers").select("id"),
        supabase.from("worker_payments").select("amount, date"),
        supabase.from("worker_advances").select("amount"),
        supabase.from("website_reservations").select("id").eq("status", "PENDING"),
        supabase.from("clients").select("id"),
        settlementsApi.pending().catch(() => []),
      ]);

    const cars = rows(carsRes.data);
    const sales = rows(salesRes.data).map(shapeSale);
    const purchases = rows(purchasesRes.data).map(shapePurchase);
    const expenses = rows(expensesRes.data);

    const salesMonth = sales.filter((s) => s.date >= monthStartISO);
    const caMonth = salesMonth.reduce((a, s) => a + (s.totalAfterReduction || 0), 0);
    const clientDebts = sales.reduce((a, s) => a + (s.amountRest > 0 ? s.amountRest : 0), 0);
    const purchaseDebts = purchases.reduce((a, p) => a + (p.amountRest > 0 ? p.amountRest : 0), 0);
    const totalExpensesAll = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const expensesMonthTotal = expenses
      .filter((e) => (e.date || "").slice(0, 7) === monthStr)
      .reduce((a, e) => a + (e.amount || 0), 0);
    const totalSalesAll = sales.reduce((a, s) => a + (s.totalAfterReduction || 0), 0);
    const totalPurchaseAll = purchases.reduce((a, p) => a + (p.purchasePrice || 0), 0);

    const soldThisMonth = new Set(
      sales.filter((s) => s.date >= monthStartISO && s.car?.status === "SOLD").map((s) => s.carId)
    );

    // 12-month series
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        sales: 0,
        purchases: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
      });
    }
    const mIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const s of sales) {
      const k = monthKey(new Date(s.date));
      if (k in mIndex) {
        months[mIndex[k]].sales += 1;
        months[mIndex[k]].revenue += s.totalAfterReduction || 0;
      }
    }
    for (const p of purchases) {
      const k = p.date ? monthKey(new Date(p.date)) : null;
      if (k && k in mIndex) months[mIndex[k]].purchases += 1;
    }
    for (const e of expenses) {
      const k = e.date ? monthKey(new Date(e.date)) : null;
      if (k && k in mIndex) months[mIndex[k]].expenses += e.amount || 0;
    }
    months.forEach((m) => (m.profit = m.revenue - m.expenses));

    const payrollMonth = rows(workerPaymentsRes.data)
      .filter((p) => (p.date || "") >= monthStartISO.slice(0, 10))
      .reduce((a, p) => a + (p.amount || 0), 0);
    const pendingAdvances = rows(advancesRes.data).reduce((a, x) => a + (x.amount || 0), 0);

    const availableCount = cars.filter((c) => c.status === "AVAILABLE").length;
    const soldCount = cars.filter((c) => c.status === "SOLD").length;
    const reservedCount = cars.filter((c) => c.status === "RESERVED").length;
    const clientsInDebt = sales.filter((s) => s.amountRest > 0).length;
    const purchasesInDebt = purchases.filter((p) => p.amountRest > 0).length;

    return {
      kpis: {
        carsInStock: availableCount,
        carsSoldMonth: soldThisMonth.size,
        carsReserved: reservedCount,
        caMonth,
        clientDebts,
        purchaseDebts,
        expensesMonth: expensesMonthTotal,
        netProfit: totalSalesAll - totalPurchaseAll - totalExpensesAll,
      },
      // Money-free totals across every interface — what the dashboard renders.
      counts: {
        totalCars: cars.length,
        available: availableCount,
        sold: soldCount,
        reserved: reservedCount,
        soldThisMonth: soldThisMonth.size,
        purchasesThisMonth: purchases.filter((p) => (p.date || "") >= monthStartISO).length,
        totalPurchases: purchases.length,
        totalSales: sales.length,
        totalClients: (clientsRes.data || []).length,
        totalWorkers: (workersRes.data || []).length,
        totalExpenses: expenses.length,
        clientsInDebt,
        purchasesInDebt,
        pendingSettlements: pendingSettlements.length,
      },
      charts: {
        months,
        statusDistribution: {
          AVAILABLE: cars.filter((c) => c.status === "AVAILABLE").length,
          SOLD: cars.filter((c) => c.status === "SOLD").length,
          RESERVED: cars.filter((c) => c.status === "RESERVED").length,
        },
      },
      lists: {
        lastPurchases: purchases.slice(0, 5),
        lastSales: sales.slice(0, 5),
        lastExpenses: expenses.slice(0, 5),
      },
      workers: {
        count: (workersRes.data || []).length,
        payrollMonth,
        pendingAdvances,
      },
      website: {
        pendingReservations: (reservationsRes.data || []).length,
        hiddenOffers: cars.filter((c) => c.hidden).length,
      },
      // Vehicles sold for a client whose owner has not been settled yet.
      settlements: {
        pending: pendingSettlements,
        count: pendingSettlements.length,
        total: pendingSettlements.reduce((a, p) => a + (p.ownerAmount || 0), 0),
      },
    };
  },
};

// ── WEBSITE ───────────────────────────────────────────────────
function priceFromCar(car) {
  if (!car) return 0;
  // `cars.price` is kept in sync with the purchase by a database trigger, so the
  // public site can show a price without reading the purchases table.
  if (Number(car.price) > 0) return Number(car.price);
  const list = car.purchases || (car.purchase ? [car.purchase] : []);
  return list[0]?.sellingPrice || 0;
}

export const websiteApi = {
  async offers() {
    const { data } = await supabase
      .from("cars")
      .select("*, car_documents(*), purchases(selling_price)")
      .eq("status", "AVAILABLE")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    return rows(data).map((c) => {
      shapeCar(c);
      c.price = priceFromCar(c);
      return c;
    });
  },
  async adminOffers() {
    const { data } = await supabase
      .from("cars")
      .select("*, car_documents(*), purchases(selling_price)")
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false });
    return rows(data).map((c) => {
      shapeCar(c);
      c.price = priceFromCar(c);
      return c;
    });
  },
  async specialOffers() {
    const { data } = await supabase
      .from("special_offers")
      .select("*, car:cars(*, car_documents(*), hidden, purchases(selling_price))")
      .order("created_at", { ascending: false });
    return rows(data).map((o) => {
      if (o.car) shapeCar(o.car);
      o.carId = o.carId ?? o.car?.id;
      o.hidden = o.car?.hidden || false;
      o.oldPrice = o.oldPrice || priceFromCar(o.car);
      return o;
    });
  },
  async publicSpecialOffers() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("special_offers")
      .select("*, car:cars(*, car_documents(*), hidden, status, purchases(selling_price))")
      .lte("start_date", now)
      .gte("end_date", now)
      .order("created_at", { ascending: false });
    return rows(data)
      .filter((o) => o.car && !o.car.hidden)
      .map((o) => {
        shapeCar(o.car);
        o.oldPrice = o.oldPrice || priceFromCar(o.car);
        return o;
      });
  },
  async createSpecialOffer(payload) {
    // store the current selling price as old_price for the strike-through display
    const { data: pur } = await supabase
      .from("purchases")
      .select("selling_price")
      .eq("car_id", payload.carId)
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("special_offers")
      .insert({
        car_id: payload.carId,
        special_price: Number(payload.specialPrice) || 0,
        old_price: pur?.selling_price || null,
        start_date: payload.startDate || new Date().toISOString(),
        end_date: payload.endDate,
      })
      .select()
      .single();
    if (error) throw error;
    return toCamel(data);
  },
  async deleteSpecialOffer(id) {
    const { error } = await supabase.from("special_offers").delete().eq("id", id);
    if (error) throw error;
  },
  async setVisibility(carId, hidden) {
    const { error } = await supabase.from("cars").update({ hidden }).eq("id", carId);
    if (error) throw error;
  },
  async reservations() {
    const { data } = await supabase
      .from("website_reservations")
      .select("*, car:cars(brand, model, plate, images)")
      .order("created_at", { ascending: false });
    return rows(data);
  },
  async createReservation({ carId, clientName, clientPhone }) {
    const { error } = await supabase
      .from("website_reservations")
      .insert({ car_id: carId, client_name: clientName, client_phone: clientPhone });
    if (error) throw error;
  },
  async updateReservationStatus(id, status) {
    const { data, error } = await supabase
      .from("website_reservations")
      .update({ status })
      .eq("id", id)
      .select("car_id")
      .single();
    if (error) throw error;
    if (status === "ACCEPTED" && data?.car_id) {
      await supabase.from("cars").update({ status: "RESERVED" }).eq("id", data.car_id);
    }
  },
  async getContacts() {
    const row = await getSettingsRow();
    const s = row || {};
    return {
      facebook: s.facebook || "",
      instagram: s.instagram || "",
      tiktok: s.tiktok || "",
      maps: s.maps || "",
      whatsapp: s.whatsapp || "",
    };
  },
  async updateContacts(payload) {
    const row = await getSettingsRow();
    const patch = {
      facebook: payload.facebook,
      instagram: payload.instagram,
      tiktok: payload.tiktok,
      maps: payload.maps,
      whatsapp: payload.whatsapp,
    };
    const q = row?.id
      ? supabase.from("settings").update(patch).eq("id", row.id)
      : supabase.from("settings").insert(patch);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return toCamel(data);
  },
};

// ── REPORTS ───────────────────────────────────────────────────
export const reportsApi = {
  async generate({ from, to } = {}) {
    const startISO = from ? new Date(from).toISOString() : null;
    const endISO = to ? new Date(to + "T23:59:59").toISOString() : null;

    const applyRange = (q, col = "date") => {
      if (startISO) q = q.gte(col, startISO);
      if (endISO) q = q.lte(col, endISO);
      return q;
    };

    const [salesRes, purchasesRes, expensesRes, workersRes] = await Promise.all([
      applyRange(supabase.from("sales").select("*, car:cars(*), client:clients(*)").order("date", { ascending: false })),
      applyRange(
        supabase.from("purchases").select("*, car:cars(*), client:clients(*)").order("date", { ascending: false })
      ),
      (() => {
        let q = supabase.from("expenses").select("*, car:cars(*)").order("date", { ascending: false });
        if (from) q = q.gte("date", from);
        if (to) q = q.lte("date", to);
        return q;
      })(),
      supabase
        .from("workers")
        .select("*, role:worker_roles(*), payments:worker_payments(*), advances:worker_advances(*), absences:worker_absences(*)"),
    ]);

    const sales = rows(salesRes.data).map(shapeSale);
    const purchases = rows(purchasesRes.data).map(shapePurchase);
    const expenses = rows(expensesRes.data);
    const workers = rows(workersRes.data);

    const carExpenses = expenses.filter((e) => e.type === "CAR");
    const showroomExpenses = expenses.filter((e) => e.type === "SHOWROOM");

    const totalSalesAmount = sales.reduce((a, s) => a + (s.totalAfterReduction || 0), 0);
    const totalPurchaseAmount = purchases.reduce((a, p) => a + (p.purchasePrice || 0), 0);
    const totalCarExpenses = carExpenses.reduce((a, e) => a + (e.amount || 0), 0);
    const totalShowroomExpenses = showroomExpenses.reduce((a, e) => a + (e.amount || 0), 0);
    const grossProfit = totalSalesAmount - totalPurchaseAmount;
    const netProfit = grossProfit - totalCarExpenses - totalShowroomExpenses;

    // per-car analysis
    const carIds = new Set();
    sales.forEach((s) => s.carId && carIds.add(s.carId));
    purchases.forEach((p) => p.carId && carIds.add(p.carId));
    carExpenses.forEach((e) => e.carId && carIds.add(e.carId));

    let carAnalysis = [];
    if (carIds.size) {
      const { data: carsData } = await supabase
        .from("cars")
        .select("*, car_documents(*), purchases(*), sales(*), expenses(*)")
        .in("id", Array.from(carIds));
      carAnalysis = rows(carsData).map((car) => {
        shapeCar(car);
        const purchasePrice = car.purchase?.purchasePrice || 0;
        const carExpList = (car.expenses || []).filter((e) => e.type === "CAR");
        const carExp = carExpList.reduce((a, e) => a + (e.amount || 0), 0);
        const salePrice = (car.sales || []).reduce((a, s) => a + (s.totalAfterReduction || 0), 0);
        const totalCost = purchasePrice + carExp;
        const grossMargin = salePrice - purchasePrice;
        const netMargin = salePrice - totalCost;
        const netMarginPct = salePrice ? (netMargin / salePrice) * 100 : 0;
        const { purchases: _p, sales: _s, expenses: _e, ...carBase } = car;
        return {
          car: carBase,
          purchasePrice,
          expenses: carExp,
          totalCost,
          salePrice,
          grossMargin,
          netMargin,
          netMarginPct: Math.round(netMarginPct * 10) / 10,
          expenseList: carExpList,
        };
      });
    }

    const clientDebts = sales
      .filter((s) => s.amountRest > 0)
      .map((s) => ({
        client: s.client,
        car: s.car,
        total: s.totalAfterReduction,
        paid: s.amountPaid,
        rest: s.amountRest,
        date: s.date,
      }));

    const purchaseDebts = purchases
      .filter((p) => p.amountRest > 0)
      .map((p) => ({
        source: p.client ? `${p.client.firstName} ${p.client.lastName}` : "—",
        sourceType: p.sourceType,
        car: p.car,
        total: p.purchasePrice,
        paid: p.amountPaid,
        rest: p.amountRest,
        date: p.date,
      }));

    const inRange = (d) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      if (startISO && t < new Date(startISO).getTime()) return false;
      if (endISO && t > new Date(endISO).getTime()) return false;
      return true;
    };
    const payroll = workers.map((w) => {
      const advances = (w.advances || []).filter((x) => inRange(x.date)).reduce((a, x) => a + (x.amount || 0), 0);
      const absences = (w.absences || []).filter((x) => inRange(x.date)).reduce((a, x) => a + (x.cost || 0), 0);
      const netPaid = (w.payments || []).filter((x) => inRange(x.date)).reduce((a, x) => a + (x.amount || 0), 0);
      return {
        fullName: w.fullName,
        role: w.role?.name || "—",
        baseSalary: w.paymentAmount || 0,
        paymentType: w.paymentType,
        advances,
        absences,
        netPaid,
      };
    });

    const clientSourcedPurchases = purchases
      .filter((p) => p.sourceType === "CLIENT")
      .map((p) => ({
        source: p.client ? `${p.client.firstName} ${p.client.lastName}` : "—",
        car: p.car,
        total: p.purchasePrice,
        paid: p.amountPaid,
        rest: p.amountRest,
        date: p.date,
      }));

    return {
      synthese: {
        totalSalesCount: sales.length,
        totalSalesAmount,
        totalPurchaseCount: purchases.length,
        totalPurchaseAmount,
        totalCarExpenses,
        totalShowroomExpenses,
        grossProfit,
        netProfit,
      },
      sales,
      purchases,
      carAnalysis,
      showroomExpenses,
      clientDebts,
      purchaseDebts,
      payroll,
      clientSourcedPurchases,
    };
  },
};

// Kept as a passthrough — image URLs are now always absolute Supabase URLs.
export function imageUrl(path) {
  return path || null;
}

export default {
  auth,
  settingsApi,
  settlementsApi,
  carsApi,
  purchasesApi,
  salesApi,
  clientsApi,
  workersApi,
  expensesApi,
  cashApi,
  paymentsApi,
  dashboardApi,
  websiteApi,
  reportsApi,
};
