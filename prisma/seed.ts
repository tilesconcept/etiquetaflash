import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@tilesconceptar.com';
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

  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultProductType: 'CP',
      defaultLengthCm: 30,
      defaultWidthCm: 20,
      defaultHeightCm: 15,
      defaultWeightKg: 1.5,
      defaultContentValue: 0,
      defaultFlexId: 'flex',
      originName: 'Tiles Concept',
      originStreet: 'Larrea',
      originNumber: '1381',
      originCity: 'CIUDAD AUTONOMA BUENOS AIRES',
      originProvince: 'Buenos Aires',
      originPostalCode: '1117',
      originPhone: '+5491100000000',
      originEmail: 'envios@tilesconceptar.com',
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
