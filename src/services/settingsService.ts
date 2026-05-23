import type { Settings } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ExportContext } from './exporters/types';

export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 'default' } });
}

export function toExportContext(s: Settings): ExportContext {
  return {
    defaultProductType: s.defaultProductType,
    defaultLengthCm: s.defaultLengthCm,
    defaultWidthCm: s.defaultWidthCm,
    defaultHeightCm: s.defaultHeightCm,
    defaultWeightKg: s.defaultWeightKg,
    defaultContentValue: s.defaultContentValue,
    defaultFlexId: s.defaultFlexId,
  };
}
