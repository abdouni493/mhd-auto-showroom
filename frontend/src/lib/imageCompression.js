import imageCompression from "browser-image-compression";
import { BUCKETS } from "./supabase.js";

// ── Client-side image optimisation ──────────────────────────────────────────
// Every image a user picks is squeezed in the browser (off the main thread, via
// a Web Worker) BEFORE it travels to Supabase Storage. A 10 MB phone photo
// typically lands under ~1 MB, which slashes upload time, bandwidth and the
// storage bill — and makes the Showroom / website galleries load far faster.
//
// Library: browser-image-compression (MIT) — the battle-tested choice for this.
//   https://github.com/Donaldcwl/browser-image-compression

// Per-bucket profiles. Photos are re-encoded to WebP (smaller than JPEG/PNG at
// equal quality and, unlike JPEG, keeps transparency), resized so the longest
// edge fits `maxWidthOrHeight`, then pushed under `maxSizeMB`. Document scans
// keep more resolution so small text stays legible.
const PROFILES = {
  [BUCKETS.carImages]:    { maxSizeMB: 1,   maxWidthOrHeight: 1920, fileType: "image/webp", initialQuality: 0.82 },
  [BUCKETS.clientPhotos]: { maxSizeMB: 0.6, maxWidthOrHeight: 1280, fileType: "image/webp", initialQuality: 0.82 },
  [BUCKETS.carDocuments]: { maxSizeMB: 1.5, maxWidthOrHeight: 2560, fileType: "image/webp", initialQuality: 0.85 },
  [BUCKETS.showroomLogo]: { maxSizeMB: 0.4, maxWidthOrHeight: 768,  fileType: "image/webp", initialQuality: 0.9  },
};
const DEFAULT_PROFILE = PROFILES[BUCKETS.carImages];

// Types we must NOT feed to the raster compressor:
//   • SVG — vector; re-encoding would rasterise & bloat it (logos)
//   • PDF — not an image at all (a car document can be a PDF)
//   • GIF — may be animated; compression flattens it to a single frame
const SKIP_TYPES = new Set(["image/svg+xml", "application/pdf", "image/gif"]);

const EXT_BY_TYPE = {
  "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
  "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

// File extension matching a MIME type (used to name the stored object correctly
// after re-encoding — the compressor keeps the original .jpg name otherwise).
export function extForType(type, fallback = "jpg") {
  return EXT_BY_TYPE[type] || fallback;
}

// Compress a single File for a given storage bucket. NEVER throws: on any error,
// or for a skipped type, the original file is returned so an upload is never
// blocked (fail-open). Also refuses a "compressed" result that ended up larger
// than the source (can happen for already-tiny images).
export async function compressForBucket(file, bucket) {
  if (!file || !file.type || !file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) {
    return file;
  }
  const profile = PROFILES[bucket] || DEFAULT_PROFILE;
  try {
    const compressed = await imageCompression(file, { useWebWorker: true, ...profile });
    return compressed && compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

// Human-readable size, e.g. "842 KB" / "1.4 MB" — handy for upload feedback.
export function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
