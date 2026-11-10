import { secrets } from "base44:runtime";
import { toE164 } from "./phone.ts";

export { toE164 };

const TWILIO = "https://api.twilio.com/2010-04-01";
const config = () => ({
  sid: secrets.get("TWILIO_ACCOUNT_SID") || "",
  authToken: secrets.get("TWILIO_AUTH_TOKEN") || "",
  from: (secrets.get("TWILIO_PHONE_NUMBER") || "").trim(),
});
export const twilioAccountSid = () => config().sid;
export const twilioAuthToken = () => config().authToken;

async function twilioApi(method, path, params) {
  const { sid, authToken } = config();
  const response = await fetch(`${TWILIO}/Accounts/${sid}/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// Sends one text through Twilio's Messages API, from the shop's Twilio number.
export async function sendTwilioSms(to, body) {
  const { sid, authToken, from } = config();
  if (!sid || !authToken || !from) {
    return { ok: false, status: 500, data: { message: "Text messaging is not set up yet" } };
  }
  return twilioApi("POST", "Messages.json", { To: toE164(to), From: from, Body: body });
}

// Read-only check that the configured sending number exists on this account and can send MMS.
export async function checkMmsSender() {
  const { sid, authToken, from } = config();
  if (!sid || !authToken || !from) return { ok: false, reason: "Text messaging isn't set up (Twilio account or sending number missing)." };
  const r = await twilioApi("GET", `IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`);
  if (!r.ok) return { ok: false, reason: `Couldn't check the sending number with Twilio (HTTP ${r.status}).` };
  const number = (r.data?.incoming_phone_numbers || [])[0];
  if (!number) return { ok: false, reason: "The configured sending number isn't a phone number on this Twilio account, so PDF (picture) messages can't be confirmed." };
  if (number.capabilities?.mms !== true) return { ok: false, reason: "The shop's Twilio number can't send picture messages (MMS), so a PDF can't be attached. An MMS-capable US/Canada number is needed." };
  return { ok: true };
}

// One MMS with a single attachment that Twilio downloads from mediaUrl.
export async function sendTwilioMms({ to, body, mediaUrl, statusCallback }) {
  const { from } = config();
  const params = { To: to, From: from, Body: body, MediaUrl: mediaUrl };
  if (statusCallback) params.StatusCallback = statusCallback;
  return twilioApi("POST", "Messages.json", params);
}

export async function fetchTwilioMessage(messageSid) {
  if (!/^(SM|MM)[0-9a-f]{32}$/i.test(String(messageSid || ""))) return { ok: false, status: 400, data: {} };
  return twilioApi("GET", `Messages/${messageSid}.json`);
}