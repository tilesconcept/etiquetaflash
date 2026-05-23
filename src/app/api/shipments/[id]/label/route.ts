import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs/promises';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/shipments/{id}/label → devuelve el PDF de la etiqueta.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shipment = await prisma.shipment.findUnique({ where: { id: params.id } });
  if (!shipment || !shipment.labelPdfPath) {
    return NextResponse.json({ error: 'Etiqueta no disponible' }, { status: 404 });
  }
  try {
    const pdf = await fs.readFile(shipment.labelPdfPath);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta-${shipment.trackingNumber ?? shipment.id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el PDF en disco' }, { status: 500 });
  }
}
