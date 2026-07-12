/**
 * OBD2 PID definitions — formulas, ranges, and smart alert thresholds.
 * Used by Live Data mode for real-time sensor polling and gauge rendering.
 */

export const LIVE_PIDS = [
  { pid: '010C', key: 'rpm', name: 'Engine RPM', unit: 'rpm', formula: (A, B) => ((A * 256 + B) / 4), min: 0, max: 8000, warn: 6500, crit: 7500, icon: 'tachometer' },
  { pid: '010D', key: 'speed', name: 'Vehicle Speed', unit: 'km/h', formula: (A) => A, min: 0, max: 200, icon: 'gauge' },
  { pid: '0105', key: 'coolant', name: 'Coolant Temp', unit: '°C', formula: (A) => (A - 40), min: 0, max: 130, warn: 105, crit: 115, icon: 'thermometer' },
  { pid: '0111', key: 'throttle', name: 'Throttle Position', unit: '%', formula: (A) => Math.round((A * 100 / 255) * 10) / 10, min: 0, max: 100, icon: 'percent' },
  { pid: '0110', key: 'maf', name: 'MAF Air Flow', unit: 'g/s', formula: (A, B) => Math.round(((A * 256 + B) / 100) * 10) / 10, min: 0, max: 200, icon: 'wind' },
  { pid: '0106', key: 'stft_b1', name: 'Short Fuel Trim B1', unit: '%', formula: (A) => Math.round(((A - 128) * 100 / 128) * 10) / 10, min: -30, max: 30, warn: 15, crit: 25, icon: 'fuel' },
  { pid: '0107', key: 'ltft_b1', name: 'Long Fuel Trim B1', unit: '%', formula: (A) => Math.round(((A - 128) * 100 / 128) * 10) / 10, min: -30, max: 30, warn: 15, crit: 25, icon: 'fuel' },
  { pid: '0114', key: 'o2_b1s1', name: 'O2 Sensor B1S1', unit: 'V', formula: (A) => Math.round((A / 200) * 100) / 100, min: 0, max: 1, icon: 'activity' },
  { pid: '0115', key: 'o2_b1s2', name: 'O2 Sensor B1S2', unit: 'V', formula: (A, B) => Math.round((A / 200) * 100) / 100, min: 0, max: 1, icon: 'activity' },
  { pid: '010F', key: 'intake_temp', name: 'Intake Air Temp', unit: '°C', formula: (A) => (A - 40), min: -20, max: 80, icon: 'thermometer' },
  { pid: '0142', key: 'battery', name: 'Battery Voltage', unit: 'V', formula: (A, B) => Math.round(((A * 256 + B) / 1000) * 100) / 100, min: 0, max: 16, warn: 12.0, crit: 10.5, icon: 'battery' },
  { pid: '010E', key: 'ign_timing', name: 'Ignition Timing', unit: '°BTDC', formula: (A) => Math.round((A / 2 - 64) * 10) / 10, min: -20, max: 60, icon: 'zap' },
  { pid: '012F', key: 'fuel_level', name: 'Fuel Level', unit: '%', formula: (A) => Math.round((A * 100 / 255) * 10) / 10, min: 0, max: 100, icon: 'fuel' },
  { pid: '0133', key: 'baro', name: 'Barometric Pressure', unit: 'kPa', formula: (A) => A, min: 50, max: 110, icon: 'compass' },
  { pid: '0143', key: 'abs_load', name: 'Absolute Load', unit: '%', formula: (A, B) => Math.round(((A * 256 + B) * 100 / 255) * 10) / 10, min: 0, max: 100, icon: 'percent' },
];

export const EV_PIDS = [
  { pid: '015B', key: 'hv_battery_life', name: 'Hybrid Battery Life', unit: '%', formula: (A) => A, min: 0, max: 100, warn: 40, crit: 20, icon: 'battery-charging' },
  { pid: '015C', key: 'hv_system_status', name: 'Hybrid System Status', unit: '', formula: (A) => A, min: 0, max: 4, icon: 'zap' },
  { pid: '2101', key: 'hv_soc', name: 'HV Battery SOC', unit: '%', enhanced: true, formula: (A) => A, min: 0, max: 100, warn: 30, crit: 15, icon: 'battery-charging' },
  { pid: '2102', key: 'hv_temp', name: 'HV Battery Temp', unit: '°C', enhanced: true, formula: (A) => A - 40, min: -20, max: 80, warn: 55, crit: 65, icon: 'thermometer' },
  { pid: '2104', key: 'hv_voltage', name: 'HV Battery Voltage', unit: 'V', enhanced: true, formula: (A, B) => ((A * 256 + B) / 10), min: 0, max: 300, icon: 'zap' },
  { pid: '2109', key: 'inverter_temp', name: 'HV Inverter Temp', unit: '°C', enhanced: true, formula: (A) => A - 40, min: -20, max: 100, warn: 75, crit: 90, icon: 'thermometer' },
];

/** Evaluate live data readings and return any threshold-based alerts */
export function checkAlerts(liveData) {
  const alerts = [];

  const coolant = liveData['coolant']?.value;
  if (coolant != null && coolant > 115) {
    alerts.push({ level: 'critical', icon: 'thermometer', msg: 'OVERHEATING — stop engine immediately' });
  } else if (coolant != null && coolant > 105) {
    alerts.push({ level: 'warning', icon: 'thermometer', msg: `Coolant at ${coolant}°C — engine running hot` });
  }

  const battery = liveData['battery']?.value;
  if (battery != null && battery < 10.5) {
    alerts.push({ level: 'critical', icon: 'battery', msg: `Battery at ${battery}V — critical voltage` });
  } else if (battery != null && battery < 12.0) {
    alerts.push({ level: 'warning', icon: 'battery', msg: `Battery at ${battery}V — battery/alternator issue` });
  }

  const stft = liveData['stft_b1']?.value;
  const ltft = liveData['ltft_b1']?.value;
  if (stft != null && Math.abs(stft) > 25) {
    alerts.push({ level: 'critical', icon: 'fuel', msg: `Short fuel trim at ${stft}% — major vacuum leak or fuel issue` });
  } else if (ltft != null && Math.abs(ltft) > 15) {
    alerts.push({ level: 'warning', icon: 'fuel', msg: `Long fuel trim at ${ltft}% — system compensating for a problem` });
  }

  const o2 = liveData['o2_b1s1']?.value;
  if (o2 != null && Math.abs(o2 - 0.45) < 0.02) {
    alerts.push({ level: 'warning', icon: 'activity', msg: 'O2 sensor stuck at 0.45V — sensor may be lazy or failed' });
  }

  return alerts;
}

/** Determine gauge status color from value vs thresholds */
export function getGaugeStatus(pid, value) {
  if (value == null) return 'normal';
  if (pid.crit != null && value >= pid.crit) return 'critical';
  if (pid.warn != null && value >= pid.warn) return 'warning';
  return 'normal';
}

/** Detect if vehicle is likely hybrid/EV based on fuel type or make/model */
export function isLikelyHybrid(vehicle) {
  if (!vehicle) return false;
  const fuel = (vehicle.fuel_type || '').toLowerCase();
  if (fuel.includes('hybrid') || fuel.includes('electric') || fuel.includes('ev')) return true;
  const desc = `${vehicle.make || ''} ${vehicle.model || ''}`.toLowerCase();
  const hybridModels = ['prius', ' rav4 hybrid', ' camry hybrid', ' accord hybrid', ' highlander hybrid', ' ioniq', ' niro', ' prime'];
  return hybridModels.some(m => desc.includes(m));
}