import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Carrier } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { generateLabel } from '@/services/shipmentOrchestrator';
import { toJsonError } from '@/lib/errors';

const Body = z.object({
  orderInternalId: z.string(),
  carrier: z.nativeEnum(Carrier),
  packageOverride: z
    .object({
      weightKg: z.number().positive().optional(),
      lengthCm: z.number().positive().optional(),
      widthCm: z.number().positive().optional(),
      heightCm: z.number().positive().optional(),
    })
    .optional(),
  recipientOverride: z
    .object({
      street: z.string().optional(),
      number: z.string().optional(),
      floor: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  service: z.enum(['door_to_door', 'pickup_point']).optional(),
  updateTiendaNube: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = Body.parse(await req.json());
    const result = await generateLabel(parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
