// Pure UI state for the document text window (no React, so it is unit-tested directly).
export const PDF_ACTIVE = ["preparing", "queued", "sending"];
export const TEXT_FINAL = ["delivered", "undelivered", "failed", "canceled", "unknown", "not_sent"];

// PDF controls. "Send As Text" is independent: a failed, queued or unavailable PDF never hides or disables it.
export function pdfState(info, delivery, sending) {
  const inFlight = PDF_ACTIVE.includes(delivery?.status);
  const sentThisWindow = !!delivery && info?.latest?.id !== delivery.id;
  const pdfFailed = ["failed", "undelivered"].includes(delivery?.status);
  return {
    inFlight, sentThisWindow, pdfFailed,
    showSendPdf: !!info && !sentThisWindow,
    canSendPdf: !!info && info.sender_ready && !inFlight && !sending,
    canOpenText: !sending,
  };
}

export const TEXT_LABELS = {
  preparing: "Preparing…",
  queued: "Queued with Twilio, not delivered yet",
  sending: "Sending to the carrier…",
  sent: "Sent to the carrier, waiting for delivery confirmation",
  delivered: "Delivered to the customer's phone",
  undelivered: "Not delivered",
  failed: "Failed, this text was not sent",
  canceled: "Canceled",
  unknown: "Unconfirmed: may or may not have been sent",
  not_sent: "Not sent",
};

// Send button: only with an exact preview, a ready SMS sender, no blocker, and nothing already sent here.
export function textSendState(info, group, sending) {
  const sentHere = !!group && group.group_key === info?.this_window_key;
  return {
    sentHere,
    canSend: !!info?.parts?.length && info.sender_ready && !info.blocker && !sending && !sentHere,
    canResume: sentHere && group.can_resume && !sending,
    moving: !!group && group.parts.some((p) => !TEXT_FINAL.includes(p.status)),
  };
}