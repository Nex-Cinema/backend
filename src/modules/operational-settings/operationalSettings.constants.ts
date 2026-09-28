export const OPERATIONAL_SETTINGS_ID = 1;

export const DEFAULT_OPERATIONAL_SETTINGS = {
  ThoiGianGiuGhePhut: 10,
} as const;

export const OPERATIONAL_SETTING_LIMITS = {
  ThoiGianGiuGhePhut: { min: 1, max: 60 },
} as const;
