/**
 * elm327.js — Web Bluetooth ELM327 OBD2 client.
 *
 * Talks to any BLE ("Bluetooth Low Energy") ELM327-compatible adapter from the
 * browser directly, no native app needed. Classic Bluetooth (SPP/RFCOMM)
 * adapters CANNOT be used — Web Bluetooth only supports BLE (GATT) devices.
 * When buying a dongle, look for "BLE 4.0" in the listing (e.g. Vgate iCar
 * Pro BLE 4.0, Veepeak OBDCheck BLE) — NOT a plain "Bluetooth" classic one.
 *
 * Most BLE ELM327 clones expose a UART-style GATT service with one
 * write characteristic and one notify characteristic. We try the common
 * known service/characteristic UUIDs used across the popular clones.
 */

// Known UART-style service profiles used by common BLE ELM327 adapters.
// We try each until requestDevice/connect succeeds with a matching service.
const KNOWN_UART_PROFILES = [
  // Vgate iCar Pro 2S (BLE 5.x) — confirmed profile for this specific model
  {
    service: "000018f0-0000-1000-8000-00805f9b34fb",
    write: "00002af1-0000-1000-8000-00805f9b34fb",
    notify: "00002af0-0000-1000-8000-00805f9b34fb",
  },
  // Nordic UART Service (NUS) — Vgate iCar Pro BLE4.0, many others
  {
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  },
  // Generic "FFF0" service — many HC-08/JDY based OBD BLE readers
  {
    service: "0000fff0-0000-1000-8000-00805f9b34fb",
    write: "0000fff2-0000-1000-8000-00805f9b34fb",
    notify: "0000fff1-0000-1000-8000-00805f9b34fb",
  },
];

const ALL_KNOWN_UUIDS = Array.from(
  new Set(KNOWN_UART_PROFILES.flatMap(p => [p.service, p.write, p.notify]))
);

export class ELM327Client {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.buffer = "";
    this.pending = null; // { resolve, reject, timeout }
    this._queue = Promise.resolve(); // serializes commands so concurrent callers can't interleave
  }

  static isSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  async connect() {
    if (!ELM327Client.isSupported()) {
      throw new Error(
        "This browser doesn't support Web Bluetooth. Use Chrome or Edge on Android/desktop (not supported on iOS Safari)."
      );
    }

    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ALL_KNOWN_UUIDS,
    });

    this.server = await this.device.gatt.connect();

    let matched = null;
    for (const profile of KNOWN_UART_PROFILES) {
      try {
        const service = await this.server.getPrimaryService(profile.service);
        const writeChar = await service.getCharacteristic(profile.write);
        const notifyChar = await service.getCharacteristic(profile.notify);
        matched = { writeChar, notifyChar };
        break;
      } catch (e) {
        // try next known profile
      }
    }

    if (!matched) {
      await this.disconnect();
      throw new Error(
        "Connected to the device but couldn't find a compatible OBD2 service. This adapter's Bluetooth profile isn't supported yet — let us know the exact model and we'll add it."
      );
    }

    this.writeChar = matched.writeChar;
    this.notifyChar = matched.notifyChar;

    await this.notifyChar.startNotifications();
    this.notifyChar.addEventListener("characteristicvaluechanged", (e) =>
      this._onData(e.target.value)
    );

    // Standard ELM327 init sequence
    await this._sendCommand("ATZ", 2000);   // reset
    await this._sendCommand("ATE0");        // echo off
    await this._sendCommand("ATL0");        // linefeeds off
    await this._sendCommand("ATH0");        // headers off
    await this._sendCommand("ATSP0", 5000);  // auto-detect protocol

    return { name: this.device.name || "OBD2 Adapter" };
  }

  async disconnect() {
    try {
      if (this.notifyChar) await this.notifyChar.stopNotifications();
    } catch (e) { /* ignore */ }
    try {
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } catch (e) { /* ignore */ }
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
  }

  get isConnected() {
    return !!this.device?.gatt?.connected;
  }

  _onData(dataView) {
    const text = new TextDecoder().decode(dataView);
    this.buffer += text;
    if (this.buffer.includes(">")) {
      const response = this.buffer.replace(/>/g, "").trim();
      this.buffer = "";
      if (this.pending) {
        clearTimeout(this.pending.timeout);
        this.pending.resolve(response);
        this.pending = null;
      }
    }
  }

  // Public entry point — queues onto _queue so only one command is ever
  // in flight at a time, even if callers fire multiple requests concurrently
  // (e.g. Promise.all([readDTCs(), readLiveData()])).
  _sendCommand(command, timeoutMs = 4000) {
    const run = () => this._sendCommandInternal(command, timeoutMs);
    const result = this._queue.then(run, run);
    this._queue = result.catch(() => {}); // keep the chain alive even after a failed command
    return result;
  }

  async _sendCommandInternal(command, timeoutMs) {
    if (!this.writeChar) throw new Error("Not connected to an OBD2 adapter.");

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending = null;
        reject(new Error(`No response from adapter for command "${command}" (timed out).`));
      }, timeoutMs);

      this.pending = { resolve, reject, timeout };

      try {
        const bytes = new TextEncoder().encode(command + "\r");
        await this.writeChar.writeValue(bytes);
      } catch (err) {
        clearTimeout(timeout);
        this.pending = null;
        reject(err);
      }
    });
  }

  /** Read Diagnostic Trouble Codes (Mode 03). Returns array of { raw, code }. */
  /**
   * Read Diagnostic Trouble Codes (Mode 03). Some clone BLE chips are slow to
   * complete their protocol auto-search on the very first real query — give
   * it several increasingly patient attempts (up to ~75s total) before
   * giving up, rather than failing after a single short timeout.
   */
  async readDTCs(onProgress) {
    const attempts = [15000, 25000, 35000];
    let lastErr;

    for (let i = 0; i < attempts.length; i++) {
      if (onProgress) onProgress(i + 1, attempts.length);
      try {
        const response = await this._sendCommand("03", attempts[i]);
        if (/UNABLE TO CONNECT/i.test(response)) {
          lastErr = new Error("UNABLE_TO_CONNECT");
          await this._sendCommand("ATSP0", 5000).catch(() => {}); // re-kick protocol search
          continue;
        }
        return parseDTCResponse(response);
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    throw new Error(
      "Still no response from the vehicle after several tries (~75s). Check: 1) key is in the ON/ACC position (engine doesn't need to be running, but ignition must be on), 2) the adapter is fully clicked into the OBD2 port — not loose, 3) try cycling the key off and back on, then reconnect. If it still won't respond, this vehicle's OBD protocol may not be supported by this adapter."
    );
  }

  /** Read pending DTCs (Mode 07) — codes detected but not yet confirmed/stored. */
  async readPendingDTCs() {
    try {
      const response = await this._sendCommand("07", 15000);
      if (/NO DATA|UNABLE TO CONNECT/i.test(response)) return [];
      // Mode 07 response has no "47" prefix on some adapters — handle both
      const clean = response.replace(/\s+/g, "").replace(/SEARCHING\.*/gi, "").trim();
      const hex = clean.replace(/^47/i, "");
      return parseDTCFromHex(hex);
    } catch (e) {
      return [];
    }
  }

  /** Read permanent DTCs (Mode 0A) — codes the ECU won't let you clear; only the vehicle itself clears them once the fault is fixed. */
  async readPermanentDTCs() {
    try {
      const response = await this._sendCommand("0A", 15000);
      if (/NO DATA|UNABLE TO CONNECT/i.test(response)) return [];
      const clean = response.replace(/\s+/g, "").replace(/SEARCHING\.*/gi, "").trim();
      const hex = clean.replace(/^4A/i, "");
      return parseDTCFromHex(hex);
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear Diagnostic Trouble Codes + turn off the check engine light (Mode 04).
   * ELM327 responds with "44" (mode 04 + 0x40) on success — NOT "OK".
   * Some adapters also return "OK" or just ">" with no data; treat all
   * non-error responses as success, since the ECU accepts the clear.
   */
  async clearDTCs() {
    const response = await this._sendCommand("04", 8000);
    const upper = (response || "").toUpperCase();
    // "NO DATA" / "UNABLE TO CONNECT" / "ERROR" = failure
    if (/NO DATA|UNABLE TO CONNECT|ERROR|CAN ERROR/i.test(upper)) return false;
    // "44" = standard Mode 04 success response, "OK" = some adapters
    return /44|OK/i.test(upper) || upper.length === 0;
  }

  /** Read a batch of common live-data PIDs. Returns partial object — missing PIDs are omitted. */
  async readLiveData() {
    const results = {};

    const jobs = [
      { pid: "010C", key: "rpm", parse: (b) => ((b[0] * 256 + b[1]) / 4) },
      { pid: "0105", key: "coolant_temp_c", parse: (b) => b[0] - 40 },
      { pid: "010D", key: "speed_kph", parse: (b) => b[0] },
      { pid: "012F", key: "fuel_level_pct", parse: (b) => Math.round((b[0] * 100) / 255) },
      { pid: "0104", key: "engine_load_pct", parse: (b) => Math.round((b[0] * 100) / 255) },
      { pid: "010F", key: "intake_temp_c", parse: (b) => b[0] - 40 },
    ];

    for (const job of jobs) {
      try {
        const response = await this._sendCommand(job.pid);
        const bytes = parseOBDDataBytes(response, job.pid);
        if (bytes) results[job.key] = job.parse(bytes);
      } catch (e) {
        // skip unsupported PID, keep going
      }
    }

    return results;
  }
}

/** Parses a raw ELM327 hex response for a given PID request into its data bytes. */
function parseOBDDataBytes(response, pidSent) {
  // Response looks like "41 0C 1A F8" (mode+0x40, pid, data bytes...)
  const clean = response.replace(/\s+/g, " ").trim();
  const lines = clean.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const hexPairs = line.split(" ").filter(Boolean);
    if (hexPairs.length < 3) continue;
    const mode = hexPairs[0];
    const expectedMode = (parseInt(pidSent.slice(0, 2), 16) + 0x40).toString(16).toUpperCase();
    if (mode.toUpperCase() !== expectedMode.padStart(2, "0")) continue;
    const dataBytes = hexPairs.slice(2).map(h => parseInt(h, 16)).filter(n => !isNaN(n));
    if (dataBytes.length) return dataBytes;
  }
  return null;
}

/** Decodes a raw Mode 03 response into human-readable DTC codes (e.g. "P0301"). */
export function parseDTCResponse(response) {
  const clean = response.replace(/\s+/g, "").replace(/SEARCHING\.*/gi, "").trim();
  const hex = clean.replace(/^43/i, ""); // strip the "43" mode-response prefix if present
  const codes = [];

  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const chunk = hex.slice(i, i + 4);
    if (chunk === "0000") continue; // padding / no code
    const code = decodeDTC(chunk);
    if (code) codes.push({ raw: chunk, code });
  }

  return codes;
}

/** Parse a raw hex string (already stripped of mode prefix) into DTC codes. */
function parseDTCFromHex(hex) {
  const codes = [];
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const chunk = hex.slice(i, i + 4);
    if (chunk === "0000") continue;
    const code = decodeDTC(chunk);
    if (code) codes.push({ raw: chunk, code });
  }
  return codes;
}

function decodeDTC(hexChunk) {
  if (!/^[0-9A-Fa-f]{4}$/.test(hexChunk)) return null;
  const firstByte = parseInt(hexChunk.slice(0, 2), 16);
  const prefixBits = (firstByte & 0xc0) >> 6;
  const prefixMap = ["P", "C", "B", "U"];
  const prefix = prefixMap[prefixBits];
  const firstDigit = (firstByte & 0x30) >> 4;
  const rest = hexChunk.slice(1); // remaining 3 hex chars
  return `${prefix}${firstDigit}${rest.toUpperCase()}`;
}