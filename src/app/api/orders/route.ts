import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/orders?carrier=CORREO_ARGENTINO&exported=false
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const where: Record<string, unknown> = {};
  const carrier = url.searchParams.get('carrier');
  if (carrier) where.carrier = carrier;
  const exported = url.searchParams.get('exported');
  if (exported === 'true' || exported === 'false') where.exported = exported === 'true';

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return NextResponse.json({ orders });
}

// DELETE /api/orders?ids=a,b,c
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids');
  if (!idsParam) return NextResponse.json({ error: 'Falta ids' }, { status: 400 });
  const ids = idsParam.split(',').filter(Boolean);
  const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: result.count });
}
