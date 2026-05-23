import fs from 'fs/promises';
import path from 'path';
import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateLabelPdf, labelsDir } from '@/lib/pdf';
import { AppError, ValidationError } from '@/lib/errors';
import { validateOrderForShipment } from '@/validators/orderValidator';
import type { NormalizedOrder, ShipmentPayload } from '@/types/order';
import type { ShippingProvider } from './shippingProvider';
import { CorreoArgentinoService } from './correoArgentinoService';
import { SinergiaService } from './sinergiaService';
import { TiendaNubeService } from './tiendaNubeService';
import { decrypt } from '@/lib/encryption';

export function resolveProvider(carrier: Carrier): ShippingProvider {
  switch (carrier) {
    case Carrier.CORREO_ARGENTINO:
      return new CorreoArgentinoService();
    case Carrier.SINERGIA:
      return new SinergiaService();
    default:
      throw new AppError(`Carrier no soportado: ${carrier}`, 'UNSUPPORTED_CARRIER', 400);
  }
}

export interface GenerateLabelInput {
  orderInternalId: string;
  carrier: Carrier;
  packageOverride?: Partial<ShipmentPayload['package']>;
  recipientOverride?: Partial<NormalizedOrder['shipTo'] & NormalizedOrder['customer']>;
  service?: 'door_to_door' | 'pickup_point';
  updateTiendaNube?: boolean;
}

export async function generateLabel(input: GenerateLabelInput): Promise<{
  shipmentId: string;
  trackingNumber: string;
  labelFilePath: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderInternalId },
    include: { store: { include: { settings: true } } },
  });
  if (!order) throw new AppError('Pedido no encontrado', 'NOT_FOUND', 404);

  const settings = order.store.settings;
  if (!settings) {
    throw new AppError(
      'Falta configuración de la tienda. Completar /settings.',
      'NO_SETTINGS',
      400,
    );
  }

  const normalized: NormalizedOrder = {
    id: order.id,
    tiendaNubeOrderId: order.tiendaNubeOrderId,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingStatus: order.shippingStatus,
    totalAmount: order.totalAmount,
    currency: order.currency,
    customer: {
      firstName: order.customerName.split(' ')[0] ?? '',
      lastName: order.customerName.split(' ').slice(1).join(' '),
      fullName: order.customerName,
      email: order.customerEmail ?? undefined,
      phone: input.recipientOverride?.phone ?? order.customerPhone ?? undefined,
      document: order.customerDocument ?? undefined,
    },
    shipTo: {
      street: input.recipientOverride?.street ?? order.shipAddress ?? undefined,
      number: input.recipientOverride?.number ?? order.shipNumber ?? undefined,
      floor: input.recipientOverride?.floor ?? order.shipFloor ?? undefined,
      city: input.recipientOverride?.city ?? order.shipCity ?? undefined,
      province: input.recipientOverride?.province ?? order.shipProvince ?? undefined,
      postalCode: input.recipientOverride?.postalCode ?? order.shipPostalCode ?? undefined,
      country: order.shipCountry,
    },
    items: [],
    labelGenerated: order.labelGenerated,
  };

  const valErrors = validateOrderForShipment(normalized);
  if (valErrors.length > 0) {
    throw new ValidationError('Faltan datos para generar la etiqueta', valErrors);
  }

  const payload: ShipmentPayload = {
    order: normalized,
    package: {
      weightKg: input.packageOverride?.weightKg ?? settings.defaultWeightKg,
      lengthCm: input.packageOverride?.lengthCm ?? settings.defaultLengthCm,
      widthCm: input.packageOverride?.widthCm ?? settings.defaultWidthCm,
      heightCm: input.packageOverride?.heightCm ?? settings.defaultHeightCm,
    },
    sender: {
      name: settings.originName,
      street: settings.originStreet,
      number: settings.originNumber,
      city: settings.originCity,
      province: settings.originProvince,
      postalCode: settings.originPostalCode,
      phone: settings.originPhone,
      email: settings.originEmail,
    },
    service: input.service,
  };

  const provider = resolveProvider(input.carrier);

  const shipment = await prisma.shipment.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      tiendaNubeOrderId: order.tiendaNubeOrderId,
      carrier: input.carrier,
      status: ShipmentStatus.PENDING,
      rawRequest: payload as unknown as object,
    },
  });

  try {
    const result = await provider.createShipment(payload);

    // PDF: si el carrier devolvió bytes, usamos esos. Si devolvió URL, descargamos.
    // Si no devolvió nada, generamos uno propio.
    let pdfBytes: Uint8Array | undefined = result.labelPdfBytes;
    if (!pdfBytes && result.labelUrl) {
      const res = await fetch(result.labelUrl);
      if (res.ok) pdfBytes = new Uint8Array(await res.arrayBuffer());
    }
    if (!pdfBytes) {
      const pdf = await generateLabelPdf({
        trackingNumber: result.trackingNumber,
        carrier: input.carrier,
        orderNumber: order.orderNumber,
        recipient: {
          name: normalized.customer.fullName,
          address: [normalized.shipTo.street, normalized.shipTo.number]
            .filter(Boolean)
            .join(' '),
          city: normalized.shipTo.city ?? '',
          province: normalized.shipTo.province ?? '',
          postalCode: normalized.shipTo.postalCode ?? '',
          phone: normalized.customer.phone,
          document: normalized.customer.document,
        },
        sender: {
          name: payload.sender.name,
          address: `${payload.sender.street} ${payload.sender.number}`,
          city: payload.sender.city,
          province: payload.sender.province,
          postalCode: payload.sender.postalCode,
          phone: payload.sender.phone,
        },
        packageInfo: payload.package,
      });
      pdfBytes = pdf.bytes;
    }

    const fileName = `${input.carrier.toLowerCase()}-${result.trackingNumber}.pdf`;
    const filePath = path.join(labelsDir(), fileName);
    await fs.mkdir(labelsDir(), { recursive: true });
    await fs.writeFile(filePath, pdfBytes);

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.LABEL_READY,
        trackingNumber: result.trackingNumber,
        labelUrl: result.labelUrl,
        labelPdfPath: filePath,
        rawResponse: result.rawResponse as object,
      },
    });

    await prisma.shippingLabel.create({
      data: {
        shipmentId: shipment.id,
        fileName,
        filePath,
        sizeBytes: pdfBytes.byteLength,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { labelGenerated: true },
    });

    // Actualizar tracking en Tienda Nube (opcional, según flag).
    if (input.updateTiendaNube && order.store.accessTokenEnc && order.store.accessTokenEnc !== 'mock') {
      try {
        const accessToken = decrypt(order.store.accessTokenEnc);
        const tn = new TiendaNubeService({
          storeId: order.store.tiendaNubeId,
          accessToken,
        });
        await tn.updateOrderTracking(order.tiendaNubeOrderId, {
          number: result.trackingNumber,
          carrier: input.carrier,
        });
      } catch (err) {
        // No bloqueamos el flujo: la etiqueta ya se generó.
        console.warn('No se pudo actualizar tracking en Tienda Nube:', err);
      }
    }

    return {
      shipmentId: shipment.id,
      trackingNumber: result.trackingNumber,
      labelFilePath: filePath,
    };
  } catch (err) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.ERROR,
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
      },
    });
    throw err;
  }
}
