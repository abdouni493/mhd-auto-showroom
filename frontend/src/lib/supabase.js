import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nnqrfbqxqfepjwglfgiu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucXJmYnF4cWZlcGp3Z2xmZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzM4MDEsImV4cCI6MjEwNDkwOTgwMX0.oUEOM6CELz0itvzaVysv6f5RyHxrmONggP3KJy7qP3Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "showroom-auth",
  },
});

// A throwaway client used ONLY to create new auth accounts (e.g. an admin creating
// a worker login). It never persists a session, so calling signUp on it does NOT
// replace the currently logged-in admin's session on the main client.
export function createIsolatedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "showroom-auth-temp" },
  });
}

// Storage bucket names (kept in one place)
export const BUCKETS = {
  carImages: "car-images",
  carDocuments: "car-documents",
  clientPhotos: "client-photos",
  showroomLogo: "showroom-logo",
};

// Helper: get the full public URL for any bucket object
export function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Storage buckets only allow authenticated writes. getSession() also refreshes an
// expired access token, so calling this before an upload guarantees the request
// carries a valid token (an expired/missing one is the usual cause of a 400/403
// "new row violates row-level security policy" on upload).
export async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    throw new Error("Session expirée. Veuillez vous reconnecter pour téléverser des fichiers.");
  }
  return data.session;
}

// Buckets enforce allowed_mime_types. If file.type is empty (some browsers / scans),
// an undefined content-type defaults to application/octet-stream and the upload is
// REJECTED. Infer a sensible content-type from the extension so uploads never fail.
const MIME_BY_EXT = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf",
};
export function guessContentType(file) {
  if (file?.type) return file.type;
  const ext = (file?.name?.split(".").pop() || "").toLowerCase();
  return MIME_BY_EXT[ext] || "image/jpeg";
}

// Helper: upload a file and return its public URL
export async function uploadFile(bucket, path, file) {
  await requireSession();
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: guessContentType(file),
  });
  if (error) throw error;
  return getPublicUrl(bucket, data.path);
}

// ── snake_case <-> camelCase deep converters ────────────────────────────────
// Supabase/PostgREST return snake_case columns, but every component in this app
// was written against the old (camelCase) backend. We convert reads to camelCase
// globally so components keep working unchanged.
//
// Some JSONB columns hold opaque application data whose KEYS must not be touched
// (the inspection checklist and the worker-role permission map). We leave their
// values exactly as stored.
const OPAQUE_KEYS = new Set(["inspection", "permissions"]);

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

// Deep-convert object keys snake_case -> camelCase (arrays & nested relations too).
export function toCamel(value) {
  if (Array.isArray(value)) return value.map(toCamel);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[snakeToCamel(k)] = OPAQUE_KEYS.has(k) ? v : toCamel(v);
    }
    return out;
  }
  return value;
}
