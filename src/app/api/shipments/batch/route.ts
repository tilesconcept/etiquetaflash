import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Carrier } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { generateLabel } from '@/services/shipmentOrchestrator';
import { toJsonError } from '@/lib/errors';

const Body = z.object({
  orderInternalIds: z.array(z.string()).min(1).max(50),
  carrier: z.nativeEnum(Carrier),
  service: z.enum(['door_to_door', 'pickup_point']).optional(),
  updateTiendaNube: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { orderInternalIds, carrier, service, updateTiendaNube } = Body.parse(await req.json());
    const results = await Promise.allSettled(
      orderInternalIds.map((id) =>
        generateLabel({ orderInternalId: id, carrier, service, updateTiendaNube }),
      ),
    );
    const summary = results.map((r, i) =>
      r.status === 'fulfilled'
        ? { orderInternalId: orderInternalIds[i], ok: true, ...r.value }
        : {
            orderInternalId: orderInternalIds[i],
            ok: false,
            error: r.reason instanceof Error ? r.reason.message : 'Error desconocido',
          },
    );
    return NextResponse.json({ results: summary });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
