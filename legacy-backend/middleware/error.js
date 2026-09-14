export function errorHandler(err, req, res, next) {
  console.error("[ERROR]", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Erreur interne du serveur",
  });
}

export function notFound(req, res) {
  res.status(404).json({ error: "Route introuvable" });
}

// Wrap async route handlers to forward errors to the error handler
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
