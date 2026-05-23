import { describe, it, expect } from 'vitest';
import {
  validateOrderForShipment,
  isValidArPhone,
  isValidArPostalCode,
} from '@/validators/orderValidator';
import type { NormalizedOrder } from '@/types/order';

function makeOrder(over: Partial<NormalizedOrder> = {}): NormalizedOrder {
  return {
    id: 'x',
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
    ...over,
  };
}

describe('validateOrderForShipment', () => {
  it('un pedido completo no devuelve errores', () => {
    expect(validateOrderForShipment(makeOrder())).toEqual([]);
  });

  it('detecta falta de nombre, teléfono, dirección, ciudad, provincia y CP', () => {
    const issues = validateOrderForShipment(
      makeOrder({
        customer: {
          firstName: '',
          lastName: '',
          fullName: '',
          phone: '',
          email: '',
          document: '',
        },
        shipTo: { country: 'AR' },
      }),
    );
    const fields = issues.map((i) => i.field).sort();
    expect(fields).toEqual(
      [
        'customer.fullName',
        'customer.phone',
        'shipTo.city',
        'shipTo.postalCode',
        'shipTo.province',
        'shipTo.street',
      ].sort(),
    );
  });

  it('detecta CP inválido', () => {
    const issues = validateOrderForShipment(makeOrder({ shipTo: { ...makeOrder().shipTo, postalCode: '12' } }));
    expect(issues.some((i) => i.field === 'shipTo.postalCode')).toBe(true);
  });

  it('acepta CPA (formato C1414AAA)', () => {
    expect(isValidArPostalCode('C1414AAA')).toBe(true);
    expect(isValidArPostalCode('1414')).toBe(true);
    expect(isValidArPostalCode('14')).toBe(false);
  });

  it('valida teléfono argentino tolerante', () => {
    expect(isValidArPhone('+54 9 11 4567-8901')).toBe(true);
    expect(isValidArPhone('1145678901')).toBe(true);
    expect(isValidArPhone('123')).toBe(false);
  });
});
