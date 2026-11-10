// Pure UI state for "Text Ready For Pickup" (no React, unit-tested directly).
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";
const FINAL = ["delivered", "undelivered", "failed", "canceled", "unknown", "not_sent"];

// Same estimate the server uses (GSM-7 vs Unicode); the server re-checks before sending.
export function segmentInfo(text) {
  let units = 0;
  for (const ch of text) {
    if (GSM.includes(ch)) units += 1;
    else if (GSM_EXT.includes(ch)) units += 2;
    else { const n = text.length; return { chars: [...text].length, unicode: true, segments: n <= 70 ? 1 : Math.ceil(n / 67) }; }
  }
  return { chars: [...text].length, unicode: false, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
}

export const fullMessage = (body, footer) => `${String(body || "").trim()}\n${footer || ""}`.trim();

// Send is allowed once per window; after a definite failure the same text can be retried, or edited
// text sent as a fresh send (new reference). Nothing is ever sent without a click.
export function pickupSendState({ info, group, windowKey, body, sentBody, sending }) {
  const sentHere = !!group && group.group_key === windowKey;
  const seg = segmentInfo(fullMessage(body, info?.footer));
  const tooLong = seg.segments > (info?.max_segments || 3);
  const ready = !!info && !info.blocker && info.sender_ready && !!String(body || "").trim() && !tooLong && !sending;
  const edited = String(body || "").trim() !== String(sentBody || "").trim();
  return {
    sentHere, seg, tooLong,
    canSend: ready && (!sentHere || (group.can_resume && edited)),
    freshKey: sentHere && group.can_resume && edited,
    canRetry: ready && sentHere && group.can_resume && !edited,
    moving: !!group && group.parts.some((p) => !FINAL.includes(p.status)),
    accepted: sentHere && group.accepted > 0,
  };
}