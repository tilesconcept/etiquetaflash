import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// En serverless el archivo no se persiste en disco — para re-descargar, hay
// que volver a exportar. Mantenemos la ruta para no romper links viejos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(
    {
      error:
        'Re-descarga no disponible en serverless. Volvé al dashboard y exportá nuevamente las mismas órdenes.',
    },
    { status: 410 },
  );
}
