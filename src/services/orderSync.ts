import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { TiendaNubeService } from './tiendaNubeService';
import { env } from '@/lib/env';

// Trae pedidos pendientes desde Tienda Nube (o mocks si MOCK_MODE) y los
// upsertea en la DB. Mantiene el JSON crudo en `raw` para auditoría.
export async function syncPendingOrders(): Promise<{ synced: number; storeId: string }> {
  // Tomamos la primera store (single tenant en MVP).
  const store = await prisma.store.findFirst({ orderBy: { connectedAt: 'asc' } });
  if (!store) throw new Error('No hay tienda conectada. Conectá Tienda Nube o corré el seed.');

  let accessToken: string | undefined;
  if (!env().MOCK_MODE && store.accessTokenEnc && store.accessTokenEnc !== 'mock') {
    try {
      accessToken = decrypt(store.accessTokenEnc);
    } catch {
      accessToken = undefined;
    }
  }

  const tn = new TiendaNubeService({
    storeId: store.tiendaNubeId,
    accessToken: accessToken ?? '',
  });

  const orders = await tn.listPendingOrders();
  let synced = 0;
  for (const o of orders) {
    await prisma.order.upsert({
      where: { tiendaNubeOrderId: o.tiendaNubeOrderId },
      update: {
        status: o.status,
        paymentStatus: o.paymentStatus,
        shippingStatus: o.shippingStatus,
        totalAmount: o.totalAmount,
        currency: o.currency,
        customerName: o.customer.fullName,
        customerEmail: o.customer.email,
        customerPhone: o.customer.phone,
        customerDocument: o.customer.document,
        shipAddress: o.shipTo.street,
        shipNumber: o.shipTo.number,
        shipFloor: o.shipTo.floor,
        shipCity: o.shipTo.city,
        shipProvince: o.shipTo.province,
        shipPostalCode: o.shipTo.postalCode,
        shipCountry: o.shipTo.country,
        raw: o as unknown as object,
      },
      create: {
        storeId: store.id,
        tiendaNubeOrderId: o.tiendaNubeOrderId,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        shippingStatus: o.shippingStatus,
        totalAmount: o.totalAmount,
        currency: o.currency,
        customerName: o.customer.fullName,
        customerEmail: o.customer.email,
        customerPhone: o.customer.phone,
        customerDocument: o.customer.document,
        shipAddress: o.shipTo.street,
        shipNumber: o.shipTo.number,
        shipFloor: o.shipTo.floor,
        shipCity: o.shipTo.city,
        shipProvince: o.shipTo.province,
        shipPostalCode: o.shipTo.postalCode,
        shipCountry: o.shipTo.country,
        raw: o as unknown as object,
      },
    });
    synced++;
  }
  return { synced, storeId: store.id };
}
