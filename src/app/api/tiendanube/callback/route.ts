import { NextResponse } from 'next/server';
import { TiendaNubeService } from '@/services/tiendaNubeService';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { toJsonError } from '@/lib/errors';

// Callback OAuth de Tienda Nube.
// Configurar en la app de partners: redirect_uri = {NEXTAUTH_URL}/api/tiendanube/callback
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'Falta `code`' }, { status: 400 });

    const token = await TiendaNubeService.exchangeCodeForToken(code);
    // user_id es el storeId en Nuvemshop.
    const storeId = String(token.user_id);

    await prisma.store.upsert({
      where: { tiendaNubeId: storeId },
      update: {
        accessTokenEnc: encrypt(token.access_token),
        scope: token.scope,
      },
      create: {
        tiendaNubeId: storeId,
        name: 'Tiles Concept',
        accessTokenEnc: encrypt(token.access_token),
        scope: token.scope,
        settings: {
          create: {
            originName: 'Tiles Concept',
            originStreet: '',
            originNumber: '',
            originCity: '',
            originProvince: '',
            originPostalCode: '',
          },
        },
      },
    });

    return NextResponse.redirect(new URL('/dashboard?connected=1', req.url));
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
