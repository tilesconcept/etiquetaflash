import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTiendaNubePdf } from '@/services/pdfParser';
import { inferProvinceCode } from '@/services/pdfParser';
import { toJsonError } from '@/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/uploads
// FormData con uno o más campos "files" (PDFs).
// Parsea cada PDF, extrae todas las etiquetas que encuentre y las upsertea
// como Order en la DB.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 });
    }

    const results: Array<{ fileName: string; parsed: number; errors?: string }> = [];
    let totalUpserted = 0;

    for (const file of files) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const labels = await parseTiendaNubePdf(buf, file.name);
        for (const l of labels) {
          await prisma.order.upsert({
            where: {
              orderNumber_packageNumber: {
                orderNumber: l.orderNumber,
                packageNumber: l.packageNumber ?? '1',
              },
            },
            update: {
              source: 'PDF_UPLOAD',
              sourceFileName: file.name,
              carrier: l.carrier === 'OTRO' ? 'CORREO_ARGENTINO' : l.carrier,
              shippingMode: l.shippingMode,
              pickupBranchName: l.pickupBranchName,
              pickupBranchAddress: l.pickupBranchAddress,
              recipientName: l.recipientName ?? '',
              recipientEmail: l.recipientEmail,
              recipientPhone: l.recipientPhone,
              recipientDni: l.recipientDni,
              shipStreet: l.shipStreet,
              shipNumber: l.shipNumber,
              shipFloor: l.shipFloor,
              shipApartment: l.shipApartment,
              shipLocality: l.shipLocality,
              shipProvince: l.shipProvince,
              shipProvinceCode: inferProvinceCode(l),
              shipPostalCode: l.shipPostalCode,
              productsSummary: l.productsSummary,
              productsJson: l.productsJson as unknown as object,
              pdfRawText: l.rawText,
            },
            create: {
              orderNumber: l.orderNumber,
              packageNumber: l.packageNumber ?? '1',
              source: 'PDF_UPLOAD',
              sourceFileName: file.name,
              carrier: l.carrier === 'OTRO' ? 'CORREO_ARGENTINO' : l.carrier,
              shippingMode: l.shippingMode,
              pickupBranchName: l.pickupBranchName,
              pickupBranchAddress: l.pickupBranchAddress,
              recipientName: l.recipientName ?? '',
              recipientEmail: l.recipientEmail,
              recipientPhone: l.recipientPhone,
              recipientDni: l.recipientDni,
              shipStreet: l.shipStreet,
              shipNumber: l.shipNumber,
              shipFloor: l.shipFloor,
              shipApartment: l.shipApartment,
              shipLocality: l.shipLocality,
              shipProvince: l.shipProvince,
              shipProvinceCode: inferProvinceCode(l),
              shipPostalCode: l.shipPostalCode,
              productsSummary: l.productsSummary,
              productsJson: l.productsJson as unknown as object,
              pdfRawText: l.rawText,
            },
          });
          totalUpserted++;
        }
        results.push({ fileName: file.name, parsed: labels.length });
      } catch (e) {
        results.push({
          fileName: file.name,
          parsed: 0,
          errors: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({ totalUpserted, results });
  } catch (err) {
    const { status, body } = toJsonError(err);
    return NextResponse.json(body, { status });
  }
}
