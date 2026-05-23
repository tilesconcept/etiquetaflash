import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs/promises';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/exports/{id}/download — vuelve a descargar un export ya generado.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const exp = await prisma.export.findUnique({ where: { id: params.id } });
  if (!exp) return NextResponse.json({ error: 'Export no encontrado' }, { status: 404 });
  try {
    const buf = await fs.readFile(exp.filePath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': exp.mimeType,
        'Content-Disposition': `attachment; filename="${exp.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo ya no existe en disco' }, { status: 410 });
  }
}
