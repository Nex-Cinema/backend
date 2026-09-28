import prisma from '../../config/prisma';
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  OPERATIONAL_SETTINGS_ID,
} from './operationalSettings.constants';
import type { UpdateOperationalSettingsInput } from './operationalSettings.validator';

const publicSettingsSelect = {
  Id: true,
  ThoiGianGiuGhePhut: true,
  NgayCapNhat: true,
} as const;

export const getOperationalSettings = async () => {
  const existing = await prisma.cauHinhVanHanh.findUnique({
    where: { Id: OPERATIONAL_SETTINGS_ID },
    select: publicSettingsSelect,
  });

  if (existing) return existing;

  return prisma.cauHinhVanHanh.create({
    data: {
      Id: OPERATIONAL_SETTINGS_ID,
      ...DEFAULT_OPERATIONAL_SETTINGS,
    },
    select: publicSettingsSelect,
  });
};

export const updateOperationalSettings = async (input: UpdateOperationalSettingsInput) =>
  prisma.cauHinhVanHanh.upsert({
    where: { Id: OPERATIONAL_SETTINGS_ID },
    update: input,
    create: {
      Id: OPERATIONAL_SETTINGS_ID,
      ...DEFAULT_OPERATIONAL_SETTINGS,
      ...input,
    },
    select: publicSettingsSelect,
  });

export const operationalSettings = {
  get: getOperationalSettings,
  update: updateOperationalSettings,
};
