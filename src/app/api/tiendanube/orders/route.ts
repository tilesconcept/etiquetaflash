import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncPendingOrders } from '@/services/orderSync';
import { toJsonError } from '@/lib/errors';

// GET: lista pedidos cacheados (con filtros).
// Query params:
//   ?refresh=true → sincroniza primero desde Tienda Nube
//   ?labelGenerated=true|false
//   ?shippingStatus=unpacked|packed|shipped
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('refresh') === 'true') {
      await syncPendingOrders();
    }
    const where: Record<string, unknown> = {};
    const lg = url.searchParams.get('labelGenerated');
    if (lg === 'true' || lg === 'false') where.labelGenerated = lg === 'true';
    const ss = url.searchParams.get('shippingStatus');
    if (ss) where.shippingStatus = ss;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { shipments: { select: { trackingNumber: true, carrier: true, status: true, labelPdfPath: true, id: true } } },
    });
    return NextResponse.json({ orders });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
