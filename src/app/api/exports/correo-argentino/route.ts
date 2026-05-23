import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toJsonError } from '@/lib/errors';
import { exportCorreoArgentino, validateForCorreoArgentino } from '@/services/exporters/correoArgentinoExporter';
import { getSettings, toExportContext } from '@/services/settingsService';

const Body = z.object({
  orderIds: z.array(z.string()).min(1).max(500),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { orderIds, dryRun } = Body.parse(await req.json());
    const orders = await prisma.order.findMany({ where: { id: { in: orderIds } } });
    if (orders.length === 0) {
      return NextResponse.json({ error: 'No se encontraron pedidos' }, { status: 404 });
    }

    const settings = await getSettings();
    const ctx = toExportContext(settings);
    const issues = validateForCorreoArgentino(orders, ctx);
    if (dryRun) return NextResponse.json({ issues, count: orders.length });

    if (issues.length > 0) {
      return NextResponse.json(
        { error: 'Hay datos faltantes/incorrectos', code: 'VALIDATION', details: issues },
        { status: 422 },
      );
    }

    const out = exportCorreoArgentino(orders, ctx);

    const userId = (session.user as { id?: string })?.id;
    const exp = await prisma.export.create({
      data: {
        userId: userId ?? null,
        platform: 'CORREO_ARGENTINO',
        fileName: out.fileName,
        filePath: 'inline',
        mimeType: out.mimeType,
        rowCount: out.rowCount,
        sizeBytes: out.buffer.byteLength,
        items: { create: orders.map((o) => ({ orderId: o.id })) },
      },
    });
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { exported: true, lastExportId: exp.id },
    });

    return new NextResponse(new Uint8Array(out.buffer), {
      status: 200,
      headers: {
        'Content-Type': out.mimeType,
        'Content-Disposition': `attachment; filename="${out.fileName}"`,
        'X-Export-Id': exp.id,
        'X-Row-Count': String(out.rowCount),
      },
    });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
