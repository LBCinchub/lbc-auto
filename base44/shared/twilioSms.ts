import { secrets } from "base44:runtime";

// Twilio expects E.164 (+16135551234). Bare 10-digit North American numbers get +1.
export function toE164(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

// Sends one text through Twilio's Messages API, from the shop's Twilio number.
export async function sendTwilioSms(to, body) {
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  const authToken = secrets.get("TWILIO_AUTH_TOKEN");
  const from = secrets.get("TWILIO_PHONE_NUMBER");
  if (!sid || !authToken || !from) {
    return { ok: false, status: 500, data: { message: "Text messaging is not set up yet" } };
  }
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toE164(to), From: from.trim(), Body: body }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}