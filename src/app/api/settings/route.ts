import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toJsonError } from '@/lib/errors';
import { getSettings } from '@/services/settingsService';

const SettingsSchema = z.object({
  defaultProductType: z.enum(['CP', 'EP', 'UP']),
  defaultLengthCm: z.number().positive(),
  defaultWidthCm: z.number().positive(),
  defaultHeightCm: z.number().positive(),
  defaultWeightKg: z.number().positive(),
  defaultContentValue: z.number().nonnegative(),
  defaultFlexId: z.string(),
  originName: z.string(),
  originStreet: z.string(),
  originNumber: z.string(),
  originCity: z.string(),
  originProvince: z.string(),
  originPostalCode: z.string(),
  originPhone: z.string(),
  originEmail: z.string().email().or(z.literal('')),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = SettingsSchema.parse(await req.json());
    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
