/**
 * Natural language → OBD2 command mapping for Tech Mode.
 * Mechanic types plain English, system converts to the right OBD2 command(s).
 */

export const NATURAL_COMMANDS = {
  // Readings
  'o2 reading': { pids: ['0114', '0115', '011B', '011C'], desc: 'O2 sensor readings' },
  'oxygen sensor': { pids: ['0114', '0115'], desc: 'O2 sensor voltages' },
  'fuel trim': { pids: ['0106', '0107', '0108', '0109'], desc: 'Fuel trim values' },
  'coolant temp': { pids: ['0105'], desc: 'Coolant temperature' },
  'coolant temperature': { pids: ['0105'], desc: 'Coolant temperature' },
  'rpm': { pids: ['010C'], desc: 'Engine RPM' },
  'engine rpm': { pids: ['010C'], desc: 'Engine RPM' },
  'maf': { pids: ['0110'], desc: 'MAF sensor reading' },
  'mass airflow': { pids: ['0110'], desc: 'MAF sensor reading' },
  'throttle': { pids: ['0111'], desc: 'Throttle position' },
  'throttle position': { pids: ['0111'], desc: 'Throttle position' },
  'battery': { pids: ['0142'], desc: 'Battery voltage' },
  'battery voltage': { pids: ['0142'], desc: 'Battery voltage' },
  'fuel level': { pids: ['012F'], desc: 'Fuel level' },
  'fuel pressure': { pids: ['0123'], desc: 'Fuel pressure' },
  'ignition timing': { pids: ['010E'], desc: 'Ignition timing advance' },
  'intake temp': { pids: ['010F'], desc: 'Intake air temperature' },
  'intake air temp': { pids: ['010F'], desc: 'Intake air temperature' },
  'egr': { pids: ['012D', '012E'], desc: 'EGR position and error' },
  'evap': { pids: ['0153', '014E'], desc: 'EVAP system pressure' },
  'barometric': { pids: ['0133'], desc: 'Barometric pressure' },
  'engine load': { pids: ['0104'], desc: 'Calculated engine load' },
  'speed': { pids: ['010D'], desc: 'Vehicle speed' },
  'vehicle speed': { pids: ['010D'], desc: 'Vehicle speed' },

  // Actuator tests (Mode 08 — bidirectional)
  'caliper test': { mode: '08', pid: '0901', desc: 'Brake caliper activation test' },
  'injector test': { mode: '08', pid: '0101', desc: 'Fuel injector test' },
  'fuel pump test': { mode: '08', pid: '0100', desc: 'Fuel pump relay test' },
  'egr test': { mode: '08', pid: '0401', desc: 'EGR valve actuation test' },
  'evap test': { mode: '08', pid: '0500', desc: 'EVAP purge valve test' },
  'cooling fan test': { mode: '08', pid: '0900', desc: 'Cooling fan relay test' },
  'abs test': { mode: '08', pid: '0200', desc: 'ABS modulator test' },
  'a/c test': { mode: '08', pid: '0600', desc: 'A/C compressor relay test' },
  'throttle body relearn': { desc: 'Throttle body relearn — turn key ON, wait 3 sec, press gas pedal 5x slowly' },

  // Module resets
  'reset adaptations': { pids: ['04'], desc: 'Reset learned adaptations and clear codes' },
  'clear codes': { pids: ['04'], desc: 'Clear all stored trouble codes' },
  'clear all codes': { pids: ['04'], desc: 'Clear all stored trouble codes' },

  // Readiness monitors
  'readiness': { pids: ['0101'], desc: 'Readiness monitor status' },
  'inspection ready': { pids: ['0101', '0141'], desc: 'Emissions readiness check' },
  'emissions test': { pids: ['0101', '0141'], desc: 'Emissions readiness check' },

  // Module info
  'vin': { pids: ['0902'], desc: 'Vehicle Identification Number' },
  'module info': { pids: ['ATI'], desc: 'Adapter module info' },
  'protocol': { pids: ['ATDP'], desc: 'Detected protocol' },
  'voltage': { pids: ['ATRV'], desc: 'Adapter voltage reading' },
};

/**
 * Parse a natural language input and return matching OBD2 command(s).
 * Returns { type: 'pids'|'mode08'|'info', pids: [], desc: '' } or null.
 */
export function parseNaturalCommand(input) {
  if (!input) return null;
  const lower = input.toLowerCase().trim();

  // Direct OBD2 hex command (starts with 01/02/03/04/07/0A/08/09 or AT)
  if (/^(at|01|02|03|04|07|0a|08|09)[0-9a-f\s]*$/i.test(lower)) {
    return { type: 'raw', pids: [lower], desc: `Direct command: ${lower.toUpperCase()}` };
  }

  // Find longest matching natural command key
  const keys = Object.keys(NATURAL_COMMANDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) {
      const cmd = NATURAL_COMMANDS[key];
      if (cmd.mode) return { type: 'mode08', pids: [`${cmd.mode}${cmd.pid}`], desc: cmd.desc };
      return { type: 'pids', pids: cmd.pids, desc: cmd.desc };
    }
  }

  return null;
}

/** Quick command buttons for Tech Mode */
export const QUICK_COMMANDS = [
  { label: 'CALIPER TEST', key: 'caliper test', color: 'sky' },
  { label: 'INJECTOR TEST', key: 'injector test', color: 'sky' },
  { label: 'O2 READINGS', key: 'o2 reading', color: 'emerald' },
  { label: 'FUEL PUMP TEST', key: 'fuel pump test', color: 'sky' },
  { label: 'EGR TEST', key: 'egr test', color: 'sky' },
  { label: 'EVAP TEST', key: 'evap test', color: 'sky' },
  { label: 'RESET ADAPTATIONS', key: 'reset adaptations', color: 'amber' },
  { label: 'CLEAR ALL CODES', key: 'clear all codes', color: 'red' },
];

/** EV-specific quick commands */
export const EV_QUICK_COMMANDS = [
  { label: 'HV BATTERY STATUS', key: 'hv battery', color: 'emerald' },
  { label: 'INVERTER TEMP', key: 'inverter temp', color: 'amber' },
  { label: 'REGEN BRAKING TEST', key: 'regen', color: 'sky' },
  { label: 'CELL BALANCE', key: 'cell balance', color: 'violet' },
];