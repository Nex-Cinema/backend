export const OPERATIONAL_SETTINGS_ID = 1;

export const DEFAULT_OPERATIONAL_SETTINGS = {
  ThoiGianGiuGhePhut: 10,
  CuaSoCheckInPhut: 30,
  HanHuyCaTruocGio: 2,
} as const;

export const OPERATIONAL_SETTING_LIMITS = {
  ThoiGianGiuGhePhut: { min: 1, max: 60 },
  CuaSoCheckInPhut: { min: 0, max: 240 },
  HanHuyCaTruocGio: { min: 0, max: 168 },
} as const;
