import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Send, Terminal, AlertTriangle, Crown, Zap, Mic,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { parseNaturalCommand, QUICK_COMMANDS, EV_QUICK_COMMANDS } from "@/lib/obd/naturalCommands";
import { isLikelyHybrid } from "@/lib/obd/pids";

const COLOR_CLASSES = {
  sky: "border-sky-500/40 text-sky-400 hover:bg-sky-500/10",
  emerald: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
  amber: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
  red: "border-red-500/40 text-red-400 hover:bg-red-500/10",
  violet: "border-violet-500/40 text-violet-400 hover:bg-violet-500/10",
};

export default function TechMode({ clientRef, connState, selectedVehicle, isPro }) {
  const [input, setInput] = useState("");
  const [terminal, setTerminal] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const terminalEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const connected = connState === "connected";
  const isEV = isLikelyHybrid(selectedVehicle);
  const quickCmds = isEV ? [...QUICK_COMMANDS, ...EV_QUICK_COMMANDS] : QUICK_COMMANDS;

  useEffect(() => {
    terminalEndRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminal]);

  const addEntry = (entry) => {
    setTerminal(prev => [...prev, { ...entry, id: Date.now() + Math.random() }]);
  };

  const executeCommand = async (cmdInput) => {
    if (!cmdInput.trim() || !clientRef.current) return;
    setBusy(true);

    const parsed = parseNaturalCommand(cmdInput);
    if (!parsed) {
      addEntry({ type: "error", text: `Unknown command: "${cmdInput}". Try a natural language phrase like "coolant temp", "o2 reading", "clear codes", or send a raw OBD2 hex command (e.g. 0105).` });
      setBusy(false);
      return;
    }

    addEntry({ type: "info", text: `> ${cmdInput} — ${parsed.desc}` });

    // Execute each PID/command in the parsed result
    for (const cmd of parsed.pids) {
      try {
        const response = await clientRef.current.sendRaw(cmd, 8000);

        if (/NO DATA|UNABLE TO CONNECT|ERROR|CAN ERROR/i.test(response || "")) {
          addEntry({ type: "raw", command: cmd, text: `${response || "No data"} — this PID may not be supported by this vehicle.` });
          continue;
        }

        addEntry({ type: "raw", command: cmd, text: response || "(empty response)" });

        // Try to decode PID data
        if (/^0[0-9A-F]/i.test(cmd) && cmd.length >= 4) {
          const decoded = decodePID(cmd, response);
          if (decoded) {
            addEntry({ type: "decoded", command: cmd, ...decoded });
          }
        }
      } catch (err) {
        addEntry({ type: "error", text: `Command "${cmd}" failed: ${err?.message || "timeout"}` });
      }
    }

    setBusy(false);

    // AI interpretation
    if (parsed.pids.length > 0 && parsed.type !== "info") {
      try {
        const lastResponse = terminal[terminal.length - 1];
        const vehicleDesc = selectedVehicle
          ? `${selectedVehicle.year || ""} ${selectedVehicle.make || ""} ${selectedVehicle.model || ""}`.trim()
          : "Unknown vehicle";
        const res = await base44.functions.invoke("lbcDiagAI", {
          mode: "chat",
          vehicle: vehicleDesc,
          messages: [{
            role: "user",
            content: `OBD2 command "${cmdInput}" (${parsed.desc}) was sent to a ${vehicleDesc}. Interpret the response and tell the mechanic what it means in one short paragraph. Mention if values are normal or abnormal, and what to check next.`,
          }],
        });
        if (res.data?.reply) {
          addEntry({ type: "ai", text: res.data.reply });
        }
      } catch (e) {
        // AI interpretation is bonus, don't block on failure
      }
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    executeCommand(text);
  };

  const handleQuickCommand = (key) => {
    if (busy) return;
    executeCommand(key);
  };

  // Voice command via Web Speech API
  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addEntry({ type: "error", text: "Voice recognition not supported in this browser. Use Chrome or Edge." });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      setListening(false);
      addEntry({ type: "error", text: `Voice error: ${e.error}` });
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      // Auto-execute after short delay
      setTimeout(() => executeCommand(transcript), 300);
    };

    recognition.start();
  };

  return (
    <div className="space-y-4">
      {/* Pro gate */}
      {!isPro && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-300">
          <Crown className="w-4 h-4 shrink-0" />
          Tech Mode (direct ECU commands and bidirectional tests) requires a Pro license.
        </div>
      )}

      {/* Warning banner */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200">
          Advanced commands — use with knowledge. Bidirectional Mode 08 commands can activate vehicle components (injectors, relays, fans). Ensure safe conditions before executing actuator tests.
        </p>
      </div>

      {/* Quick command buttons */}
      <div className="flex flex-wrap gap-2">
        {quickCmds.map(cmd => (
          <button
            key={cmd.label}
            onClick={() => handleQuickCommand(cmd.key)}
            disabled={!connected || busy || !isPro}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${COLOR_CLASSES[cmd.color] || COLOR_CLASSES.sky}`}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Terminal output */}
      <div className="bg-black border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
        {terminal.length === 0 && (
          <div className="text-gray-600 text-center py-12">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Type a command or natural language below.</p>
            <p className="mt-1 text-gray-700">e.g. "coolant temp", "o2 reading", "clear codes", "0105", "ATI"</p>
          </div>
        )}
        {terminal.map(entry => (
          <TerminalEntry key={entry.id} entry={entry} />
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type command or natural language... (e.g. 'read O2 sensor')"
          disabled={!connected || busy || !isPro}
          className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
        />
        <Button
          onClick={handleVoice}
          variant="outline"
          size="icon"
          disabled={!connected || busy || !isPro}
          className={`border-gray-700 ${listening ? "text-red-400 animate-pulse" : "text-gray-400"}`}
        >
          <Mic className="w-4 h-4" />
        </Button>
        <Button
          onClick={handleSend}
          disabled={!connected || busy || !isPro || !input.trim()}
          className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          SEND
        </Button>
      </div>
    </div>
  );
}

function TerminalEntry({ entry }) {
  if (entry.type === "error") {
    return <div className="text-red-400">⚠ {entry.text}</div>;
  }
  if (entry.type === "info") {
    return <div className="text-sky-400">{entry.text}</div>;
  }
  if (entry.type === "raw") {
    return (
      <div>
        <span className="text-gray-500">RAW [{entry.command}]: </span>
        <span className="text-emerald-400">{entry.text}</span>
      </div>
    );
  }
  if (entry.type === "decoded") {
    const statusColor = entry.status === "critical" ? "text-red-400" : entry.status === "warning" ? "text-amber-400" : "text-emerald-400";
    return (
      <div>
        <span className="text-gray-500">→ </span>
        <span className="text-white font-bold">{entry.name}: {entry.value}{entry.unit} </span>
        <span className={statusColor}>[{entry.statusLabel}]</span>
        <span className="text-gray-500"> (normal: {entry.range})</span>
      </div>
    );
  }
  if (entry.type === "ai") {
    return (
      <div className="text-purple-300 border-l-2 border-purple-500/50 pl-2 mt-1">
        <span className="text-purple-500">🤖 AI: </span>{entry.text}
      </div>
    );
  }
  return <div className="text-gray-400">{entry.text}</div>;
}

/** Decode a PID response into human-readable value + range + status */
function decodePID(pid, response) {
  const PID_MAP = {
    "010C": { name: "Engine RPM", unit: " rpm", formula: (A, B) => ((A * 256 + B) / 4), range: "600-900 idle", warn: 6500, crit: 7500 },
    "010D": { name: "Vehicle Speed", unit: " km/h", formula: (A) => A, range: "0-120" },
    "0105": { name: "Coolant Temp", unit: "°C", formula: (A) => A - 40, range: "80-95 normal", warn: 105, crit: 115 },
    "0111": { name: "Throttle Position", unit: "%", formula: (A) => Math.round(A * 100 / 255), range: "0-100" },
    "0110": { name: "MAF Air Flow", unit: " g/s", formula: (A, B) => ((A * 256 + B) / 100), range: "2-10 idle" },
    "0106": { name: "Short Fuel Trim B1", unit: "%", formula: (A) => Math.round((A - 128) * 100 / 128), range: "-10 to +10", warn: 15, crit: 25 },
    "0107": { name: "Long Fuel Trim B1", unit: "%", formula: (A) => Math.round((A - 128) * 100 / 128), range: "-10 to +10", warn: 15, crit: 25 },
    "0114": { name: "O2 Sensor B1S1", unit: "V", formula: (A) => (A / 200).toFixed(2), range: "0.1-0.9 switching" },
    "0115": { name: "O2 Sensor B1S2", unit: "V", formula: (A) => (A / 200).toFixed(2), range: "0.1-0.9 switching" },
    "010F": { name: "Intake Air Temp", unit: "°C", formula: (A) => A - 40, range: "10-40" },
    "0142": { name: "Battery Voltage", unit: "V", formula: (A, B) => ((A * 256 + B) / 1000).toFixed(2), range: "12.6-14.7", warn: 12, crit: 10.5 },
    "010E": { name: "Ignition Timing", unit: "°BTDC", formula: (A) => A / 2 - 64, range: "5-15 idle" },
    "012F": { name: "Fuel Level", unit: "%", formula: (A) => Math.round(A * 100 / 255), range: "0-100" },
    "0133": { name: "Barometric Pressure", unit: " kPa", formula: (A) => A, range: "90-103" },
  };

  const meta = PID_MAP[pid.toUpperCase()];
  if (!meta) return null;

  try {
    const clean = (response || "").replace(/\s+/g, " ").trim();
    const lines = clean.split(/[\r\n]+/).filter(Boolean);
    for (const line of lines) {
      const hexPairs = line.split(" ").filter(Boolean);
      if (hexPairs.length < 3) continue;
      const dataBytes = hexPairs.slice(2).map(h => parseInt(h, 16)).filter(n => !isNaN(n));
      if (dataBytes.length >= meta.formula.length) {
        const value = meta.formula(...dataBytes);
        let status = "normal";
        let statusLabel = "🟢 NORMAL";
        if (meta.crit != null && value >= meta.crit) { status = "critical"; statusLabel = "🔴 CRITICAL"; }
        else if (meta.warn != null && value >= meta.warn) { status = "warning"; statusLabel = "🟡 WARNING"; }
        return { name: meta.name, value, unit: meta.unit, range: meta.range, status, statusLabel };
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}