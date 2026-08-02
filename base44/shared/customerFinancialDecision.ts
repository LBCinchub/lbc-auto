export function estimateDecisionState(estimate, now = Date.now()) {
  const status = String(estimate?.status || "");
  const pending = status === "sent" || estimate?.auth_status === "pending";
  const expired = Boolean(estimate?.valid_until) && new Date(`${estimate.valid_until}T23:59:59.999Z`).getTime() < now;
  return { allowed: pending && !expired, currentStatus: expired ? "expired" : status };
}

export function priorDecisionResult(events, estimateId, action, sessionId) {
  if (!events?.length) return "new";
  return events.some((item) => item.estimate_id !== estimateId || item.action !== action || item.session_id !== sessionId) ? "mismatch" : "replay";
}