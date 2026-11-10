// One LBC Auto AI request with a deadline. Never throws and never returns an empty reply, so the
// chat always shows an answer, a question or a clear failure (with a read-only Retry when it helps).
export const AI_TIMEOUT_MS = 60000;
const RETRYABLE = new Set(["timeout", "rate_limited", "unavailable", "empty_reply", "network"]);
const MSG = {
  timeout: "LBC Auto AI Took Too Long To Answer. Nothing Was Changed. Tap Retry.",
  empty_reply: "LBC Auto AI Returned An Empty Answer. Nothing Was Changed. Tap Retry.",
  network: "Could Not Reach LBC Auto AI. Check Your Connection. Nothing Was Changed. Tap Retry.",
  unauthorized: "Sign In Again To Use LBC Auto AI.",
  forbidden: "LBC Auto AI Is Not Available For Your Account.",
  rate_limited: "Too Many Assistant Requests. Wait A Minute, Then Tap Retry.",
  unavailable: "LBC Auto AI Is Unavailable Right Now. Nothing Was Changed. Tap Retry.",
};
const codeForStatus = (s) => (s === 401 ? "unauthorized" : s === 403 ? "forbidden" : s === 429 ? "rate_limited" : s >= 500 ? "unavailable" : s ? "unavailable" : "network");

export function normalizeAiResponse(raw) {
  const data = typeof raw === "string" ? { reply: raw } : raw && typeof raw === "object" ? raw : {};
  const reply = typeof data.reply === "string" ? data.reply.trim() : "";
  const code = data.error_code || data.staff?.error_code || null;
  if (!reply) return { ok: false, content: MSG.empty_reply, retryable: true, errorCode: "empty_reply", data };
  return { ok: !code, content: reply, retryable: data.retryable === true || RETRYABLE.has(code), errorCode: code, data };
}

export function errorToReply(e) {
  if (e?.code === "lbc_timeout") return { ok: false, content: MSG.timeout, retryable: true, errorCode: "timeout", data: null };
  const status = e?.response?.status ?? e?.status;
  const body = e?.response?.data;
  const code = (body && body.error_code) || codeForStatus(status);
  const reply = body && typeof body.reply === "string" && body.reply.trim() ? body.reply.trim() : MSG[code] || MSG.unavailable;
  return { ok: false, content: reply, retryable: RETRYABLE.has(code), errorCode: code, data: body && typeof body === "object" ? body : null };
}

export async function requestAiReply(invoke, payload, { timeoutMs = AI_TIMEOUT_MS } = {}) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "lbc_timeout" })), timeoutMs);
  });
  try {
    const res = await Promise.race([Promise.resolve().then(() => invoke("lbcAutoAI", payload)), deadline]);
    return normalizeAiResponse(res && typeof res === "object" && "data" in res ? res.data : res);
  } catch (e) {
    return errorToReply(e);
  } finally {
    clearTimeout(timer);
  }
}