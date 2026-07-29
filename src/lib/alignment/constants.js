export const PHASE_NOTICE = "Phase 1: LBC Alignment Companion — reporting, import, manual entry, and recovery support only. Direct machine control is not enabled until verified/calibrated hardware integration exists.";

export const ALIGNMENT_ROWS = [
  ["front_left_camber", "Front Left Camber", "front", "camber", "left"], ["front_right_camber", "Front Right Camber", "front", "camber", "right"],
  ["front_left_caster", "Front Left Caster", "front", "caster", "left"], ["front_right_caster", "Front Right Caster", "front", "caster", "right"],
  ["front_left_toe", "Front Left Toe", "front", "toe", "left"], ["front_right_toe", "Front Right Toe", "front", "toe", "right"],
  ["front_total_toe", "Front Total Toe", "front", "total_toe", "total"], ["rear_left_camber", "Rear Left Camber", "rear", "camber", "left"],
  ["rear_right_camber", "Rear Right Camber", "rear", "camber", "right"], ["rear_left_toe", "Rear Left Toe", "rear", "toe", "left"],
  ["rear_right_toe", "Rear Right Toe", "rear", "toe", "right"], ["rear_total_toe", "Rear Total Toe", "rear", "total_toe", "total"],
  ["thrust_angle", "Thrust Angle", "rear", "thrust_angle", "center"],
].map(([key, label, axle, parameter, side]) => ({ key, label, axle, parameter, side }));

export const RECOVERY_CHECKLIST = [
  "Clone old hard drive before further attempts",
  "Search recovered files for Hofmann, Snap-on, John Bean, geoliner, GeoPro, Pro42, Camera, Calibration, Spec, Database, License, Key Disk",
  "Find installer CD/USB, license dongle/key disk, old software version, camera serial, calibration photos, Device Manager screenshots",
  "Contact legacy Hofmann/Snap-on alignment repair technician with exact model EEWA712A",
  "Do not use for customer jobs until calibrated and verified",
];