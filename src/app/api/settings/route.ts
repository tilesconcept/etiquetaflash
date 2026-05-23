import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Carrier } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toJsonError } from '@/lib/errors';

const Settings = z.object({
  defaultWeightKg: z.number().positive(),
  defaultLengthCm: z.number().positive(),
  defaultWidthCm: z.number().positive(),
  defaultHeightCm: z.number().positive(),
  originName: z.string().min(1),
  originStreet: z.string().min(1),
  originNumber: z.string().min(1),
  originCity: z.string().min(1),
  originProvince: z.string().min(1),
  originPostalCode: z.string().min(1),
  originPhone: z.string().min(1),
  originEmail: z.string().email(),
  preferredCarrier: z.nativeEnum(Carrier),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const store = await prisma.store.findFirst({ include: { settings: true } });
  return NextResponse.json({ store });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = Settings.parse(await req.json());
    const store = await prisma.store.findFirst();
    if (!store) return NextResponse.json({ error: 'No hay tienda configurada' }, { status: 400 });
    const settings = await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: data,
      create: { storeId: store.id, ...data },
    });
    return NextResponse.json({ settings });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
