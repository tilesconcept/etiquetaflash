import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Carrier, ShippingMode } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toJsonError } from '@/lib/errors';
import { resolveProvinceCode, provinceCodeFromCpa } from '@/lib/argentinaProvinces';

const Patch = z.object({
  carrier: z.nativeEnum(Carrier).optional(),
  shippingMode: z.nativeEnum(ShippingMode).optional(),

  pickupBranchCode: z.string().optional().nullable(),

  recipientName: z.string().optional(),
  recipientEmail: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  recipientPhoneAreaCode: z.string().optional().nullable(),
  recipientPhoneNumber: z.string().optional().nullable(),
  recipientDni: z.string().optional().nullable(),

  shipStreet: z.string().optional().nullable(),
  shipNumber: z.string().optional().nullable(),
  shipFloor: z.string().optional().nullable(),
  shipApartment: z.string().optional().nullable(),
  shipBetweenStreets: z.string().optional().nullable(),
  shipLocality: z.string().optional().nullable(),
  shipPartido: z.string().optional().nullable(),
  shipProvince: z.string().optional().nullable(),
  shipProvinceCode: z.string().optional().nullable(),
  shipPostalCode: z.string().optional().nullable(),

  productType: z.string().optional().nullable(),
  lengthCm: z.number().positive().optional().nullable(),
  widthCm: z.number().positive().optional().nullable(),
  heightCm: z.number().positive().optional().nullable(),
  weightKg: z.number().positive().optional().nullable(),
  contentValue: z.number().nonnegative().optional().nullable(),

  flexId: z.string().optional().nullable(),
  shipmentDetail: z.string().optional().nullable(),

  notes: z.string().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = Patch.parse(await req.json());

    // Si actualizan provincia o CP, recalculamos provinceCode si no lo pasaron.
    if (!data.shipProvinceCode && (data.shipProvince || data.shipPostalCode)) {
      const code =
        provinceCodeFromCpa(data.shipPostalCode ?? undefined) ??
        resolveProvinceCode(data.shipProvince ?? undefined);
      if (code) data.shipProvinceCode = code;
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ order });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.order.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
