import { describe, it, expect, beforeEach } from 'vitest';
import { CorreoArgentinoService } from '@/services/correoArgentinoService';
import { SinergiaService } from '@/services/sinergiaService';
import type { ShipmentPayload } from '@/types/order';

// Estas envs son las mínimas que pide src/lib/env.ts.
beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'a-secret-of-at-least-16-chars-xx';
  process.env.ENCRYPTION_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
  process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/x';
  process.env.MOCK_MODE = 'true';
});

const basePayload: ShipmentPayload = {
  order: {
    id: 'a',
    tiendaNubeOrderId: '1',
    orderNumber: '1001',
    status: 'open',
    paymentStatus: 'paid',
    shippingStatus: 'unpacked',
    totalAmount: 1000,
    currency: 'ARS',
    customer: {
      firstName: 'María',
      lastName: 'García',
      fullName: 'María García',
      email: 'maria@example.com',
      phone: '+5491145678901',
      document: '32.456.789',
    },
    shipTo: {
      street: 'Corrientes',
      number: '1234',
      city: 'CABA',
      province: 'Buenos Aires',
      postalCode: '1043',
      country: 'AR',
    },
    items: [],
    labelGenerated: false,
  },
  package: { weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 15 },
  sender: {
    name: 'Tiles Concept',
    street: 'Av. Siempre Viva',
    number: '1234',
    city: 'CABA',
    province: 'CABA',
    postalCode: '1414',
    phone: '+5491100000000',
    email: 'envios@tilesconcept.com',
  },
};

describe('CorreoArgentinoService.validateShipmentData', () => {
  it('payload completo no devuelve errores', () => {
    const svc = new CorreoArgentinoService();
    expect(svc.validateShipmentData(basePayload)).toEqual([]);
  });

  it('detecta CP de destino faltante', () => {
    const svc = new CorreoArgentinoService();
    const errors = svc.validateShipmentData({
      ...basePayload,
      order: { ...basePayload.order, shipTo: { ...basePayload.order.shipTo, postalCode: '' } },
    });
    expect(errors.join(' ')).toMatch(/código postal/i);
  });

  it('detecta peso inválido', () => {
    const svc = new CorreoArgentinoService();
    const errors = svc.validateShipmentData({ ...basePayload, package: { ...basePayload.package, weightKg: 0 } });
    expect(errors.some((e) => /peso/i.test(e))).toBe(true);
  });
});

describe('SinergiaService.validateShipmentData', () => {
  it('aplica la misma forma de contrato', () => {
    const svc = new SinergiaService();
    expect(svc.validateShipmentData(basePayload)).toEqual([]);
  });
});
