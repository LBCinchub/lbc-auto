export const ELM_INIT_COMMANDS = [
  { command: "ATZ", timeout: 6000, settle: 2000, required: true },
  { command: "ATE0", timeout: 4000, required: true },
  { command: "ATL0", timeout: 4000, required: true },
  { command: "ATS0", timeout: 4000 },
  { command: "ATH0", timeout: 4000, required: true },
  { command: "ATSP0", timeout: 6000, required: true },
  { command: "ATAT1", timeout: 4000 },
  { command: "ATST64", timeout: 4000 },
];

export const ECU_RETRY_TIMEOUTS = [7000, 11000, 16000];
export const FALLBACK_PROTOCOLS = ["ATSP0", "ATSP6", "ATSP7", "ATSP8", "ATSP9"];
export const ECU_NOT_RESPONDING_MESSAGE = "Adapter connected, but vehicle ECU is not responding. Turn ignition ON / engine running, verify adapter is fully seated, then retry.";

export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function isConfirmedAdapterResponse(response) {
  const value = String(response || "").trim();
  return !!value && !/^\?|ERROR$/i.test(value);
}

export function isSupportedPidResponse(response) {
  const value = String(response || "").toUpperCase();
  return /41\s*00(?:\s*[0-9A-F]{2}){4}/.test(value) && !/NO DATA|UNABLE TO CONNECT|CAN ERROR|BUS ERROR/.test(value);
}