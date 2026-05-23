import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/setup
// Crea el usuario admin a partir de ADMIN_EMAIL / ADMIN_PASSWORD si todavía
// no existe ninguno. Idempotente: si ya hay usuarios, no hace nada.
// Visitar UNA vez después del primer deploy para inicializar la base.
export async function GET() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({
      ok: true,
      alreadyInitialized: true,
      message: 'Ya hay usuarios en la base. No se crea ninguno nuevo. Si querés resetear la contraseña, hacelo desde Prisma Studio o seteando manualmente desde la DB.',
    });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return NextResponse.json(
      {
        error:
          'Faltan ADMIN_EMAIL / ADMIN_PASSWORD en las variables de entorno. Definí ambas y volvé a llamar a /api/setup.',
      },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin Tiles Concept',
      role: 'ADMIN',
    },
  });
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  return NextResponse.json({
    ok: true,
    created: true,
    email,
    next: 'Andá a /login y entrá con ese email y la contraseña que pusiste en ADMIN_PASSWORD.',
  });
}
