import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseTiendaNubePdf, splitAndParse } from '@/services/pdfParser';

const FIXTURE = path.join(__dirname, 'fixtures', 'tn-label-pickup.pdf');

describe('pdfParser · etiqueta real de Tienda Nube (pickup en sucursal)', () => {
  it('extrae la información clave del PDF de ejemplo', async () => {
    const bytes = new Uint8Array(fs.readFileSync(FIXTURE));
    const labels = await parseTiendaNubePdf(bytes, 'tn-label-pickup.pdf');
    expect(labels).toHaveLength(1);
    const l = labels[0];
    expect(l.orderNumber).toBe('397');
    expect(l.packageNumber).toBe('1');
    expect(l.carrier).toBe('CORREO_ARGENTINO');
    expect(l.shippingMode).toBe('PICKUP_BRANCH');
    expect(l.recipientName).toBe('Olga Brua');
    expect(l.recipientPhone).toBe('+542901410609');
    expect(l.recipientDni).toBe('23889097');
    expect(l.shipLocality).toBe('USHUAIA');
    expect(l.shipProvince).toBe('Tierra del Fuego');
    expect(l.shipPostalCode).toBe('V9410BFD');
    expect(l.pickupBranchName).toMatch(/USHUAIA/);
  });
});

describe('splitAndParse · descarta mitad-recibo y deduplica', () => {
  it('cuando hay rótulo + recibo en el mismo PDF, solo toma uno', () => {
    const text = `
Orden #100 - Paquete #1
Realizada el 22/05/2026

Producto                                           Cant.

Algo                                                  1
SKU: 1

Subtotal (1)

Dirección de envío:
Sinergia
Av. Corrientes 1234
PB
CABA, Buenos Aires, 1043
Entregar a: Juan Perez
Teléfono: +5491145678901
DNI: 30111222

Remitente:
Tiles Concept

Orden #100 - Paquete #1
Datos de quien retira:

Nombre completo:
DNI:                                  Fecha:
Firma:
`;
    const labels = splitAndParse(text);
    expect(labels).toHaveLength(1);
    expect(labels[0].orderNumber).toBe('100');
    expect(labels[0].carrier).toBe('SINERGIA');
    expect(labels[0].shippingMode).toBe('HOME');
    expect(labels[0].shipStreet).toBe('Av. Corrientes');
    expect(labels[0].shipNumber).toBe('1234');
    expect(labels[0].shipLocality).toBe('CABA');
    expect(labels[0].shipPostalCode).toBe('1043');
  });

  it('parsea múltiples órdenes en un mismo texto', () => {
    const text = `
Orden #1 - Paquete #1
Dirección de envío:
Sinergia
Calle Falsa 123
PB
Rosario, Santa Fe, 2000
Entregar a: Ana
Teléfono: 3415555555
DNI: 28000000
Remitente:

Orden #2 - Paquete #1
Dirección de envío:
Sinergia
Otra 456
PB
Bahía Blanca, Buenos Aires, 8000
Entregar a: Bob
Teléfono: 2915555555
DNI: 29000000
Remitente:
`;
    const labels = splitAndParse(text);
    expect(labels.map((l) => l.orderNumber)).toEqual(['1', '2']);
  });
});
