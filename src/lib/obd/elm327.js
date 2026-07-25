import { ELM_INIT_COMMANDS, ECU_RETRY_TIMEOUTS, FALLBACK_PROTOCOLS, ECU_NOT_RESPONDING_MESSAGE, wait, isConfirmedAdapterResponse, isSupportedPidResponse } from "@/lib/obd/obdInitialization";

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
  // Vgate iCar Pro 2S / HC-08 / JDY OBD BLE readers (FFF0 service)
  {
    service: "0000fff0-0000-1000-8000-00805f9b34fb",
    write: "0000fff1-0000-1000-8000-00805f9b34fb",
    notify: "0000fff2-0000-1000-8000-00805f9b34fb",
  },
];

const ALL_KNOWN_UUIDS = Array.from(
  new Set(KNOWN_UART_PROFILES.flatMap(p => [p.service, p.write, p.notify]))
);

export class ELM327Client {
  constructor(onDisconnect) {
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.buffer = "";
    this.pending = null; // { resolve, reject, timeout }
    this._queue = Promise.resolve(); // serializes commands so concurrent callers can't interleave
    this.protocolAttempts = ["Automatic protocol detection"];
    this._onDisconnect = onDisconnect || null; // called when adapter drops unexpectedly
  }

  static isSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  async connect(onStatus) {
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

    // Small settle delay — some BLE OBD adapters (e.g. Vgate iCar Pro 2S)
    // need a moment after GATT connection before their service table is ready
    await new Promise(r => setTimeout(r, 500));

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

    // If first pass found nothing, wait 1s and retry once — some adapters are slow to enumerate
    if (!matched) {
      await new Promise(r => setTimeout(r, 1000));
      for (const profile of KNOWN_UART_PROFILES) {
        try {
          const service = await this.server.getPrimaryService(profile.service);
          const writeChar = await service.getCharacteristic(profile.write);
          const notifyChar = await service.getCharacteristic(profile.notify);
          matched = { writeChar, notifyChar };
          break;
        } catch (e) { /* try next */ }
      }
    }

    if (!matched) {
      await this.disconnect();
      throw new Error(
        "Connected to the device but couldn't find a compatible OBD2 service. Make sure: 1) The adapter is fully plugged into the OBD2 port, 2) Ignition is ON (key in ACC or engine running), 3) This is a BLE 4.0+ adapter (not classic Bluetooth). If it still fails, let us know the exact model."
      );
    }

    this.writeChar = matched.writeChar;
    this.notifyChar = matched.notifyChar;

    await this.notifyChar.startNotifications();
    this.notifyChar.addEventListener("characteristicvaluechanged", (e) =>
      this._onData(e.target.value)
    );

    // Handle unexpected adapter disconnection (out of range, power-off, etc.)
    // Reject any pending command so the caller gets an error immediately.
    this.device.addEventListener("gattserverdisconnected", () => {
      if (this.pending) {
        clearTimeout(this.pending.timeout);
        this.pending.reject(new Error("Adapter disconnected unexpectedly."));
        this.pending = null;
      }
      // Null out refs so isConnected returns false and UI can react
      this.writeChar = null;
      this.notifyChar = null;
      if (this._onDisconnect) this._onDisconnect();
    });

    this._adapterInfo = { name: this.device.name || "OBD2 Adapter", protocol: "", voltage: "", ecuResponsive: false };
    await this._initializeAdapter(onStatus);
    this._adapterInfo.ecuResponsive = await this.ensureEcuResponsive(onStatus);
    this._adapterInfo.ecuError = this._adapterInfo.ecuResponsive ? "" : ECU_NOT_RESPONDING_MESSAGE;

    try { this._adapterInfo.voltage = await this._sendCommand("ATRV", 3000); } catch (e) { /* optional */ }
    return this._adapterInfo;
  }

  async _initializeAdapter(onStatus) {
    onStatus?.("initializing");
    for (const step of ELM_INIT_COMMANDS) {
      try {
        const response = await this._sendCommand(step.command, step.timeout);
        if (step.required && !isConfirmedAdapterResponse(response)) throw new Error("Adapter did not confirm initialization.");
      } catch (error) {
        if (step.required) throw error;
      }
      if (step.settle) await wait(step.settle);
    }
  }

  async ensureEcuResponsive(onStatus) {
    let lastProtocol = "";
    onStatus?.("detecting_protocol");
    await wait(300);
    for (let i = 0; i < ECU_RETRY_TIMEOUTS.length; i++) {
      onStatus?.(i === 0 ? "contacting_ecu" : "reading_pids");
      try {
        const response = await this._sendCommand("0100", ECU_RETRY_TIMEOUTS[i]);
        if (isSupportedPidResponse(response)) {
          this.ecuResponsive = true;
          try { lastProtocol = await this._sendCommand("ATDP", 3000); } catch (e) { /* optional */ }
          this._adapterInfo = { ...this._adapterInfo, protocol: lastProtocol, ecuResponsive: true, ecuError: "" };
          return true;
        }
      } catch (e) { /* retry after protocol check */ }
      try { lastProtocol = await this._sendCommand("ATDP", 3500); } catch (e) { /* protocol may still be searching */ }
      await wait(700 + (i * 500));
    }

    onStatus?.("detecting_protocol");
    const protocolLabels = { ATSP0:"Automatic protocol detection", ATSP6:"CAN 11-bit / 500 kbaud", ATSP7:"CAN 29-bit / 500 kbaud", ATSP8:"CAN 11-bit / 250 kbaud", ATSP9:"CAN 29-bit / 250 kbaud" };
    for (const protocolCommand of FALLBACK_PROTOCOLS) {
      if (!this.protocolAttempts.includes(protocolLabels[protocolCommand])) this.protocolAttempts.push(protocolLabels[protocolCommand]);
      try {
        const selected = await this._sendCommand(protocolCommand, 5000);
        if (!isConfirmedAdapterResponse(selected)) continue;
        await wait(900);
        const response = await this._sendCommand("0100", 14000);
        if (isSupportedPidResponse(response)) {
          try { lastProtocol = await this._sendCommand("ATDP", 3000); } catch (e) { /* optional */ }
          this.ecuResponsive = true;
          this._adapterInfo = { ...this._adapterInfo, protocol: lastProtocol, ecuResponsive: true, ecuError: "" };
          return true;
        }
      } catch (e) { /* safely probe next common protocol */ }
    }

    this.ecuResponsive = false;
    this._adapterInfo = { ...this._adapterInfo, protocol: lastProtocol, ecuResponsive: false, ecuError: ECU_NOT_RESPONDING_MESSAGE };
    return false;
  }

  /** Returns adapter info (name, protocol, voltage) gathered during init */
  getAdapterInfo() {
    return this._adapterInfo || { name: this.device?.name || "OBD2 Adapter", protocol: "", voltage: "" };
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
    if (Date.now() < (this._ignoreNotificationsUntil || 0)) return;
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
      // Late notifications after a timed-out command are deliberately discarded.
      // Reusing them would associate an old response with the next queued command.
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
    const quarantineDelay = Math.max(0, (this._ignoreNotificationsUntil || 0) - Date.now());
    if (quarantineDelay) await wait(quarantineDelay);

    const normalizedCommand = String(command || "").replace(/[\r\n]+/g, "").trim();
    this.buffer = "";
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending = null;
        this.buffer = "";
        this._ignoreNotificationsUntil = Date.now() + 1000;
        reject(new Error(`No response from adapter for command "${normalizedCommand}" (timed out).`));
      }, timeoutMs);

      this.pending = { resolve, reject, timeout };

      try {
        const bytes = new TextEncoder().encode(`${normalizedCommand}\r`);
        // writeValueWithoutResponse is correct for ELM327 clones — they use ATT Write Without Response.
        // writeValue() (deprecated) can silently hang in newer Chrome versions waiting for
        // an ATT confirmation the adapter never sends.
        if (this.writeChar.properties.writeWithoutResponse) {
          await this.writeChar.writeValueWithoutResponse(bytes);
        } else {
          await this.writeChar.writeValue(bytes); // fallback for older adapters
        }
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

  /**
   * Send a raw OBD2/AT command and return the raw response string.
   * Used by Tech Mode for direct ECU commands.
   */
  async sendRaw(command, timeoutMs = 5000) {
    return await this._sendCommand(command, timeoutMs);
  }

  /**
   * Send a single PID request and return the raw response string.
   * Used by Live Data mode for individual PID polling.
   */
  async readPID(pid) {
    return await this._sendCommand(pid, 3000);
  }

  /**
   * Parse a PID response into data bytes.
   * Exposed publicly so Live Data mode can decode responses.
   */
  parsePIDResponse(response, pidSent) {
    return parseOBDDataBytes(response, pidSent);
  }

  /** Request VIN via Mode 09 PID 02. Returns a validated 17-char VIN or null. */
  async readVIN() {
    try {
      const response = await this._sendCommand("0902", 8000);
      if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) return null;
      return parseVINResponse(response);
    } catch (e) {
      return null;
    }
  }

  /** Full system scan — confirms adapter + ECU before requesting vehicle data. */
  async fullSystemScan(onProgress) {
    onProgress?.("Initializing adapter", 5);
    await this._initializeAdapter();
    onProgress?.("Detecting vehicle protocol", 12);
    const ecuResponsive = await this.ensureEcuResponsive();
    if (!ecuResponsive) return { codes: [], vin: null, ecuResponsive: false, diagnosis: ECU_NOT_RESPONDING_MESSAGE };

    onProgress?.("Vehicle identified", 20);
    const vin = await this.readVIN();
    if (vin) this._adapterInfo = { ...this._adapterInfo, vin };
    onProgress?.("Reading stored fault codes", 38);
    const stored = await this.readDTCs().catch(() => []);
    onProgress?.("Reading pending fault codes", 58);
    const pending = await this.readPendingDTCs();
    onProgress?.("Reading permanent fault codes", 78);
    const permanent = await this.readPermanentDTCs();

    const seen = new Set();
    const codes = [];
    [[stored, "stored"], [pending, "pending"], [permanent, "permanent"]].forEach(([items, type]) => {
      items.forEach(code => {
        if (!seen.has(code.code)) { seen.add(code.code); codes.push({ ...code, type }); }
      });
    });
    onProgress?.("Scan complete", 100);
    return { codes, vin: this._adapterInfo?.vin || null, ecuResponsive: true };
  }

  /** Read odometer/mileage via PID 01A6 (where supported). Returns km or null. */
  async readMileage() {
    try {
      const response = await this._sendCommand("01A6", 5000);
      if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) return null;
      const bytes = parseOBDDataBytes(response, "01A6");
      if (!bytes || bytes.length < 4) return null;
      return bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3];
    } catch (e) { return null; }
  }

  /** Query supported Mode 01 PIDs via the 0100 bitmap chain. Returns Set of "01XX" strings. */
  async getSupportedPids() {
    const supported = new Set();
    let groupPid = "0100";
    while (groupPid) {
      try {
        const response = await this._sendCommand(groupPid, 5000);
        if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) break;
        const bytes = parseOBDDataBytes(response, groupPid);
        if (!bytes || bytes.length < 4) break;
        const base = parseInt(groupPid.slice(2), 16);
        for (let i = 0; i < 32; i++) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = 7 - (i % 8);
          if (bytes[byteIdx] & (1 << bitIdx)) {
            const pidNum = base + i + 1;
            if (pidNum > 0xFE) continue;
            supported.add("01" + pidNum.toString(16).toUpperCase().padStart(2, "0"));
          }
        }
        if (!(bytes[0] & 0x01)) break; // bit 0 = next group supported
        const nextBase = base + 0x20;
        if (nextBase > 0xE0) break;
        groupPid = "01" + nextBase.toString(16).toUpperCase().padStart(2, "0");
      } catch (e) { break; }
    }
    return supported;
  }

  /** Read emissions readiness (Mode 01 PID 01). Returns structured monitor status or null. */
  async readEmissionsReadiness() {
    try {
      const response = await this._sendCommand("0101", 4000);
      if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) return null;
      const bytes = parseOBDDataBytes(response, "0101");
      if (!bytes || bytes.length < 5) return null;
      const milOn = !!(bytes[0] & 0x80);
      const dtcCount = bytes[0] & 0x7F;
      return parseReadinessMonitors(bytes, milOn, dtcCount);
    } catch (e) { return null; }
  }

  /** Read freeze frame (Mode 02 PID 02). Returns { code, raw } or null. */
  async readFreezeFrame() {
    try {
      const response = await this._sendCommand("0202", 6000);
      if (/NO DATA|UNABLE TO CONNECT|ERROR/i.test(response)) return null;
      const clean = response.replace(/\s+/g, "").replace(/SEARCHING\.*/gi, "").trim();
      const hex = clean.replace(/^42/i, "");
      if (hex.length < 4) return null;
      return { code: decodeDTC(hex.slice(0, 4)), raw: response };
    } catch (e) { return null; }
  }
}

/** Parse emissions readiness monitor bits from a PID 01 response (5 data bytes). */
function parseReadinessMonitors(bytes, milOn, dtcCount) {
  const defs = [
    { name: "Misfire", supp: 1, ready: 1, bSupp: 1, bReady: 2 },
    { name: "Fuel System", supp: 2, ready: 2, bSupp: 1, bReady: 2 },
    { name: "Components (CCM)", supp: 3, ready: 3, bSupp: 1, bReady: 2 },
    { name: "Catalyst", supp: 0, ready: 0, bSupp: 3, bReady: 4 },
    { name: "Heated Catalyst", supp: 1, ready: 1, bSupp: 3, bReady: 4 },
    { name: "Evaporative System", supp: 2, ready: 2, bSupp: 3, bReady: 4 },
    { name: "Secondary Air", supp: 3, ready: 3, bSupp: 3, bReady: 4 },
    { name: "O2 Sensor", supp: 4, ready: 4, bSupp: 3, bReady: 4 },
    { name: "O2 Sensor Heater", supp: 5, ready: 5, bSupp: 3, bReady: 4 },
    { name: "EGR / VVT", supp: 6, ready: 6, bSupp: 3, bReady: 4 },
  ];
  const monitors = [];
  for (const d of defs) {
    const supported = !!(bytes[d.bSupp] & (1 << d.supp));
    if (!supported) continue;
    const ready = !!(bytes[d.bReady] & (1 << d.ready));
    monitors.push({ name: d.name, status: ready ? "pass" : "fail" });
  }
  return { milOn, dtcCount, monitors };
}

/** Parses spaced or compact ELM327 PID responses into data bytes. */
function parseOBDDataBytes(response, pidSent) {
  const clean = String(response || "").replace(/SEARCHING\.*|NO DATA/gi, "").replace(/[^0-9A-F]/gi, "").toUpperCase();
  const responseMode = (parseInt(pidSent.slice(0, 2), 16) + 0x40).toString(16).toUpperCase().padStart(2, "0");
  const marker = responseMode + pidSent.slice(2).toUpperCase();
  const start = clean.indexOf(marker);
  if (start < 0) return null;
  const payload = clean.slice(start + marker.length);
  const bytes = payload.match(/[0-9A-F]{2}/g)?.map(h => parseInt(h, 16)) || [];
  return bytes.length ? bytes : null;
}

/** Parse ISO-TP, CAN-header, numbered-frame, spaced, or compact VIN responses. */
export function parseVINResponse(response) {
  const payload = [];
  for (const rawLine of String(response || "").toUpperCase().split(/[\r\n]+/)) {
    let line = rawLine.replace(/SEARCHING\.*|BUS INIT.*|STOPPED/g, "").replace(/^\s*[0-9A-F]+:\s*/, "").trim();
    if (!line) continue;
    let tokens;
    if (!/\s/.test(line)) {
      let compact = line.replace(/[^0-9A-F]/g, "");
      if (compact.length % 2 === 1 && /^[0-9A-F]{3}/.test(compact)) compact = compact.slice(3);
      tokens = compact.match(/[0-9A-F]{2}/g) || [];
    } else {
      tokens = line.match(/[0-9A-F]{2,3}/g) || [];
      if (tokens[0]?.length === 3) tokens.shift();
      tokens = tokens.filter(t => t.length === 2);
    }
    if (/^1[0-9A-F]$/.test(tokens[0] || "")) tokens.splice(0, 2);
    else if (/^2[0-9A-F]$/.test(tokens[0] || "")) tokens.shift();
    payload.push(...tokens);
  }
  if (!payload.length) {
    const compact = String(response || "").replace(/[^0-9A-F]/gi, "").toUpperCase();
    payload.push(...(compact.match(/[0-9A-F]{2}/g) || []));
  }
  const marker = payload.findIndex((b, i) => b === "49" && payload[i + 1] === "02");
  if (marker < 0) return null;
  const chars = payload.slice(marker + 2).map(h => parseInt(h, 16)).filter(n => (n >= 48 && n <= 57) || (n >= 65 && n <= 90)).map(n => String.fromCharCode(n)).join("");
  const vin = chars.slice(0, 17);
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && !/^0+$/.test(vin) ? vin : null;
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