// Helpers to (de)serialize JSON-string fields stored in SQLite.

export function parseJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function serializeCar(car) {
  if (!car) return car;
  return {
    ...car,
    images: parseJSON(car.images, []),
    documents: parseJSON(car.documents, []),
  };
}

export function serializePurchase(p) {
  if (!p) return p;
  return {
    ...p,
    inspection: parseJSON(p.inspection, {}),
    car: p.car ? serializeCar(p.car) : p.car,
  };
}

export function serializeSale(s) {
  if (!s) return s;
  return {
    ...s,
    inspection: parseJSON(s.inspection, {}),
    car: s.car ? serializeCar(s.car) : s.car,
  };
}

// Generate a human-friendly reference like ACH-2024-0001
export function makeReference(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(4, "0")}`;
}
