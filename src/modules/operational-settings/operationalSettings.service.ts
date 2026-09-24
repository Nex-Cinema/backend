import prisma from '../../config/prisma';
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  OPERATIONAL_SETTINGS_ID,
} from './operationalSettings.constants';
import type { UpdateOperationalSettingsInput } from './operationalSettings.validator';

export const getOperationalSettings = async () => {
  const existing = await prisma.cauHinhVanHanh.findUnique({
    where: { Id: OPERATIONAL_SETTINGS_ID },
  });

  if (existing) return existing;

  return prisma.cauHinhVanHanh.create({
    data: {
      Id: OPERATIONAL_SETTINGS_ID,
      ...DEFAULT_OPERATIONAL_SETTINGS,
    },
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
  });

export const operationalSettings = {
  get: getOperationalSettings,
  update: updateOperationalSettings,
};
