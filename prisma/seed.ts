import { PrismaClient, Carrier } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@tilesconcept.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'cambiame123';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin Tiles Concept',
      role: 'ADMIN',
    },
  });

  // Tienda mock para poder operar sin OAuth en modo MOCK_MODE.
  const store = await prisma.store.upsert({
    where: { tiendaNubeId: 'mock-store' },
    update: {},
    create: {
      tiendaNubeId: 'mock-store',
      name: 'Tiles Concept (mock)',
      accessTokenEnc: 'mock',
    },
  });

  await prisma.storeSettings.upsert({
    where: { storeId: store.id },
    update: {},
    create: {
      storeId: store.id,
      defaultWeightKg: 1.5,
      defaultLengthCm: 30,
      defaultWidthCm: 20,
      defaultHeightCm: 15,
      originName: 'Tiles Concept',
      originStreet: 'Av. Siempre Viva',
      originNumber: '1234',
      originCity: 'CABA',
      originProvince: 'Ciudad Autónoma de Buenos Aires',
      originPostalCode: '1414',
      originPhone: '+5491100000000',
      originEmail: 'envios@tilesconcept.com',
      preferredCarrier: Carrier.CORREO_ARGENTINO,
    },
  });

  console.log('Seed OK. Login:', adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
