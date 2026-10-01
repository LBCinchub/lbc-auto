// Pure: turns the server's estimate_capability into display data. Availability comes only from the server.
const ROUTE = /^\/EstimateDetail\/[^/?#]+$/;

export function toEstimateView(cap) {
  if (!cap || typeof cap !== "object" || !Array.isArray(cap.points)) return null;
  const points = cap.points.filter((p) => typeof p === "string" && p.trim()).slice(0, 40);
  const r = cap.kind === "created" ? cap.receipt : null;
  const openPath = r && typeof r.open_path === "string" && ROUTE.test(r.open_path) ? r.open_path : null;
  return {
    kind: String(cap.kind || ""),
    unavailable: cap.kind === "unavailable",
    points,
    openPath,
    copyText: openPath && typeof cap.copy_text === "string" ? cap.copy_text : "",
  };
}