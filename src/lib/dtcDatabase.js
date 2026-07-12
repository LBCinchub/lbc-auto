/**
 * Hardcoded DTC lookup table — ensures consistent, non-hallucinated
 * diagnostic data for known OBD2 trouble codes. The AI only fills
 * gaps for codes NOT in this database.
 */
export const DTC_DATABASE = {
  // Engine — Misfire
  'P0300': { name: 'Random/Multiple Cylinder Misfire Detected', system: 'Engine — Ignition', severity: 'HIGH', causes: ['Spark plugs', 'Ignition coils', 'Fuel injectors', 'Low compression'], labor_min: 1.5, labor_max: 4.0, cost_min: 150, cost_max: 850 },
  'P0301': { name: 'Cylinder 1 Misfire Detected', system: 'Engine — Ignition', severity: 'HIGH', causes: ['Spark plug', 'Ignition coil', 'Fuel injector'], labor_min: 0.5, labor_max: 2.0, cost_min: 80, cost_max: 400 },
  'P0302': { name: 'Cylinder 2 Misfire Detected', system: 'Engine — Ignition', severity: 'HIGH', causes: ['Spark plug', 'Ignition coil', 'Fuel injector'], labor_min: 0.5, labor_max: 2.0, cost_min: 80, cost_max: 400 },
  'P0303': { name: 'Cylinder 3 Misfire Detected', system: 'Engine — Ignition', severity: 'HIGH', causes: ['Spark plug', 'Ignition coil', 'Fuel injector'], labor_min: 0.5, labor_max: 2.0, cost_min: 80, cost_max: 400 },
  'P0304': { name: 'Cylinder 4 Misfire Detected', system: 'Engine — Ignition', severity: 'HIGH', causes: ['Spark plug', 'Ignition coil', 'Fuel injector'], labor_min: 0.5, labor_max: 2.0, cost_min: 80, cost_max: 400 },
  // Fuel/Air
  'P0171': { name: 'System Too Lean (Bank 1)', system: 'Fuel/Air', severity: 'MEDIUM', causes: ['MAF sensor', 'Vacuum leak', 'Fuel pump', 'O2 sensor'], labor_min: 0.5, labor_max: 3.0, cost_min: 80, cost_max: 500 },
  'P0172': { name: 'System Too Rich (Bank 1)', system: 'Fuel/Air', severity: 'MEDIUM', causes: ['O2 sensor', 'MAF sensor', 'Fuel injectors', 'Fuel pressure regulator'], labor_min: 0.5, labor_max: 2.0, cost_min: 80, cost_max: 450 },
  // Emissions
  'P0420': { name: 'Catalyst System Efficiency Below Threshold (Bank 1)', system: 'Emissions', severity: 'MEDIUM', causes: ['Catalytic converter', 'O2 sensors', 'Exhaust leak'], labor_min: 1.0, labor_max: 3.0, cost_min: 300, cost_max: 1200 },
  'P0401': { name: 'EGR Flow Insufficient', system: 'Emissions', severity: 'LOW', causes: ['EGR valve', 'EGR passages clogged', 'DPFE sensor'], labor_min: 0.5, labor_max: 2.0, cost_min: 150, cost_max: 500 },
  // Cooling
  'P0128': { name: 'Coolant Temp Below Thermostat Regulating Temp', system: 'Cooling', severity: 'MEDIUM', causes: ['Thermostat (stuck open)', 'Coolant temp sensor'], labor_min: 0.5, labor_max: 1.5, cost_min: 100, cost_max: 280 },
  // EVAP
  'P0442': { name: 'EVAP Leak Detected (Small)', system: 'EVAP', severity: 'LOW', causes: ['Gas cap loose', 'EVAP hose crack', 'Purge valve'], labor_min: 0.5, labor_max: 2.0, cost_min: 20, cost_max: 350 },
  'P0455': { name: 'EVAP Leak Detected (Large)', system: 'EVAP', severity: 'MEDIUM', causes: ['Gas cap', 'EVAP canister', 'Purge solenoid', 'Vent valve'], labor_min: 0.5, labor_max: 3.0, cost_min: 20, cost_max: 600 },
  // Engine — Sensors/VVT
  'P0340': { name: 'Camshaft Position Sensor Circuit Malfunction', system: 'Engine', severity: 'HIGH', causes: ['CMP sensor', 'Wiring', 'Timing chain'], labor_min: 0.5, labor_max: 3.0, cost_min: 150, cost_max: 600 },
  'P0011': { name: 'Camshaft Position Timing Over-Advanced (Bank 1)', system: 'Engine/VVT', severity: 'HIGH', causes: ['VVT solenoid', 'Engine oil sludge', 'Timing chain'], labor_min: 1.0, labor_max: 6.0, cost_min: 200, cost_max: 1500 },
  'P0016': { name: 'Crankshaft/Camshaft Correlation (Bank 1, Sensor A)', system: 'Engine', severity: 'HIGH', causes: ['Timing chain wear', 'VVT solenoid', 'CMP/CKP sensor'], labor_min: 2.0, labor_max: 8.0, cost_min: 400, cost_max: 2000 },
  // Transmission
  'P0700': { name: 'Transmission Control System Malfunction', system: 'Transmission', severity: 'HIGH', causes: ['TCM fault', 'Solenoid', 'Wiring'], labor_min: 1.0, labor_max: 4.0, cost_min: 200, cost_max: 2000 },
  'P0740': { name: 'Torque Converter Clutch Circuit Malfunction', system: 'Transmission', severity: 'HIGH', causes: ['TCC solenoid', 'Transmission fluid', 'TCM'], labor_min: 2.0, labor_max: 6.0, cost_min: 300, cost_max: 1800 },
  // Speed
  'P0500': { name: 'Vehicle Speed Sensor Malfunction', system: 'ABS/Speed', severity: 'MEDIUM', causes: ['VSS sensor', 'Wiring', 'ABS module'], labor_min: 0.5, labor_max: 1.5, cost_min: 100, cost_max: 350 },
  // ABS
  'C0035': { name: 'Left Front Wheel Speed Sensor Circuit', system: 'ABS', severity: 'HIGH', causes: ['Wheel speed sensor', 'Tone ring', 'Wiring harness'], labor_min: 0.5, labor_max: 1.5, cost_min: 120, cost_max: 380 },
  'C0040': { name: 'Right Front Wheel Speed Sensor Circuit', system: 'ABS', severity: 'HIGH', causes: ['Wheel speed sensor', 'Tone ring', 'Wiring'], labor_min: 0.5, labor_max: 1.5, cost_min: 120, cost_max: 380 },
  // Body
  'B1000': { name: 'ECU Internal Fault', system: 'Body', severity: 'HIGH', causes: ['ECU/PCM failure', 'Power supply', 'Ground'], labor_min: 1.0, labor_max: 4.0, cost_min: 300, cost_max: 1500 },
  // Network
  'U0100': { name: 'Lost Communication with ECM/PCM', system: 'Network', severity: 'HIGH', causes: ['CAN bus fault', 'PCM power/ground', 'Wiring'], labor_min: 1.0, labor_max: 4.0, cost_min: 200, cost_max: 1200 },
  'U0101': { name: 'Lost Communication with TCM', system: 'Network', severity: 'HIGH', causes: ['CAN bus', 'TCM power', 'Wiring'], labor_min: 1.0, labor_max: 3.0, cost_min: 200, cost_max: 1000 },
};

export function lookupDtc(code) {
  return DTC_DATABASE[(code || "").toUpperCase().trim()] || null;
}

export const SEVERITY_STYLES = {
  HIGH: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/5',
    dot: 'bg-red-500',
    text: 'text-red-400',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    label: '🔴 HIGH SEVERITY',
  },
  MEDIUM: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label: '🟡 MEDIUM SEVERITY',
  },
  LOW: {
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/5',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    label: '🟢 LOW SEVERITY',
  },
};

export function getSeverityStyle(severity) {
  return SEVERITY_STYLES[(severity || "").toUpperCase()] || SEVERITY_STYLES.HIGH;
}

/** Validates a DTC code format: P/B/C/U followed by 3-4 hex chars */
export function validateDtcCode(code) {
  return /^[PBCU][0-9A-F]{3,4}$/i.test((code || "").trim());
}

/** Parses comma-separated DTC codes, returning valid uppercase codes */
export function parseDtcInput(input) {
  return (input || "")
    .split(",")
    .map(c => c.trim().toUpperCase())
    .filter(c => c && validateDtcCode(c));
}