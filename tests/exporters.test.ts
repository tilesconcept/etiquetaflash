import { describe, it, expect } from 'vitest';
import type { Order } from '@prisma/client';
import {
  CORREO_AR_HEADERS,
  exportCorreoArgentino,
  orderToCorreoArRow,
  splitPhone,
  validateForCorreoArgentino,
} from '@/services/exporters/correoArgentinoExporter';
import {
  SINERGIA_HEADERS,
  exportSinergia,
  orderToSinergiaRow,
  validateForSinergia,
} from '@/services/exporters/sinergiaExporter';
import type { ExportContext } from '@/services/exporters/types';

const ctx: ExportContext = {
  defaultProductType: 'CP',
  defaultLengthCm: 30,
  defaultWidthCm: 20,
  defaultHeightCm: 15,
  defaultWeightKg: 1.5,
  defaultContentValue: 0,
  defaultFlexId: 'flex',
};

function makeOrder(over: Partial<Order> = {}): Order {
  const base: Order = {
    id: 'o1',
    orderNumber: '1001',
    packageNumber: '1',
    source: 'PDF_UPLOAD',
    sourceFileName: 'x.pdf',
    tiendaNubeOrderId: null,
    pdfRawText: null,
    carrier: 'CORREO_ARGENTINO',
    shippingMode: 'HOME',
    pickupBranchName: null,
    pickupBranchAddress: null,
    pickupBranchCode: null,
    recipientName: 'María García',
    recipientEmail: 'maria@example.com',
    recipientPhone: '+5491145678901',
    recipientPhoneAreaCode: null,
    recipientPhoneNumber: null,
    recipientDni: '32456789',
    shipStreet: 'Av. Corrientes',
    shipNumber: '1234',
    shipFloor: '5',
    shipApartment: 'B',
    shipBetweenStreets: 'Callao y Riobamba',
    shipLocality: 'CABA',
    shipPartido: 'Balvanera',
    shipProvince: 'Ciudad Autonoma Buenos Aires',
    shipProvinceCode: 'C',
    shipPostalCode: '1043',
    productType: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    weightKg: null,
    contentValue: null,
    flexId: null,
    shipmentDetail: null,
    productsSummary: 'Porcelanato Calacatta x4',
    productsJson: null,
    exported: false,
    lastExportId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...over };
}

describe('correoArgentinoExporter', () => {
  it('mapea un pedido a la fila CSV con los 21 campos exactos', () => {
    const r = orderToCorreoArRow(makeOrder(), ctx);
    expect(r.tipoProducto).toBe('CP');
    expect(r.provinciaCode).toBe('C');
    expect(r.calle).toBe('Av. Corrientes');
    expect(r.altura).toBe('1234');
    expect(r.codPostal).toBe('1043');
    expect(r.destinoEmail).toBe('maria@example.com');
    expect(r.codAreaCel).toBe('11');
    expect(r.cel).toBe('45678901');
  });

  it('CSV resultante empieza con BOM, usa ; y tiene los headers oficiales', () => {
    const out = exportCorreoArgentino([makeOrder()], ctx);
    const text = out.buffer.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = text.replace(/^﻿/, '').split('\r\n');
    expect(lines[0].split(';')).toEqual([...CORREO_AR_HEADERS]);
    expect(lines[1].split(';')[0]).toBe('CP');
    expect(out.fileName).toMatch(/^correo-argentino-carga-masiva-\d+-\d+\.csv$/);
  });

  it('para retiro en sucursal usa sucursalCode y omite localidad/calle/CP', () => {
    const r = orderToCorreoArRow(
      makeOrder({
        shippingMode: 'PICKUP_BRANCH',
        pickupBranchCode: 'RBA',
        shipStreet: 'no debería aparecer',
      }),
      ctx,
    );
    expect(r.sucursalCode).toBe('RBA');
    expect(r.localidad).toBeUndefined();
    expect(r.calle).toBeUndefined();
    expect(r.codPostal).toBeUndefined();
  });

  it('detecta datos faltantes obligatorios', () => {
    const issues = validateForCorreoArgentino(
      [makeOrder({ recipientEmail: null, shipProvinceCode: '', shipProvince: null, shipPostalCode: null })],
      ctx,
    );
    expect(issues.some((i) => i.includes('email'))).toBe(true);
    expect(issues.some((i) => i.includes('provincia'))).toBe(true);
  });

  it('escapa correctamente celdas con ; y comillas', () => {
    const out = exportCorreoArgentino(
      [makeOrder({ recipientName: 'Pérez; "Comillas"' })],
      ctx,
    );
    const text = out.buffer.toString('utf8');
    expect(text).toContain('"Pérez; ""Comillas"""');
  });

  it('splitPhone: separa +54 9 11 4567-8901 → area=11, num=45678901', () => {
    expect(splitPhone(null, null, '+54 9 11 4567-8901')).toEqual({ areaCode: '11', number: '45678901' });
    expect(splitPhone('11', '45678901', '+54...')).toEqual({ areaCode: '11', number: '45678901' });
    expect(splitPhone(null, null, '+542901410609')).toEqual({ areaCode: '290', number: '1410609' });
  });
});

describe('sinergiaExporter', () => {
  it('mapea un pedido a la fila con DOMICILIO compuesto', () => {
    const r = orderToSinergiaRow(makeOrder(), ctx);
    expect(r.idFlex).toBe('flex');
    expect(r.domicilio).toBe('Av. Corrientes 1234 Piso 5 Dto B');
    expect(r.localidad).toBe('CABA');
    expect(r.codigoPostal).toBe('1043');
    expect(r.destinatario).toBe('María García');
    expect(r.dniDestinatario).toBe('32456789');
  });

  it('genera XLSX válido con los headers exactos', async () => {
    const out = await exportSinergia([makeOrder()], ctx);
    expect(out.fileName).toMatch(/^sinergia-carga-masiva-\d+-\d+\.xlsx$/);
    expect(out.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // XLSX magic bytes: PK
    expect(out.buffer[0]).toBe(0x50);
    expect(out.buffer[1]).toBe(0x4b);
  });

  it('marca error si la orden es PICKUP_BRANCH (Sinergia no maneja sucursal)', () => {
    const issues = validateForSinergia([makeOrder({ shippingMode: 'PICKUP_BRANCH' })], ctx);
    expect(issues.some((i) => /retiro en sucursal/.test(i))).toBe(true);
  });

  it('DETALLE DEL ENVIO queda vacío para paquetes < 5 kg', () => {
    const r = orderToSinergiaRow(makeOrder({ weightKg: 2 }), ctx);
    expect(r.detalleDelEnvio).toBeUndefined();
  });

  it('DETALLE DEL ENVIO se completa con productsSummary si peso >= 5kg', () => {
    const r = orderToSinergiaRow(makeOrder({ weightKg: 7 }), ctx);
    expect(r.detalleDelEnvio).toBe('Porcelanato Calacatta x4');
  });
});

it('headers expuestos coinciden con lo esperado por las plataformas', () => {
  expect(CORREO_AR_HEADERS).toHaveLength(21);
  expect(SINERGIA_HEADERS).toEqual([
    'ID FLEX',
    'DOMICILIO',
    'ENTRECALLES',
    'CODIGO POSTAL',
    'LOCALIDAD',
    'PARTIDO',
    'DESTINATARIO',
    'DNI DESTINATARIO',
    'TELEFONO DESTINATARIO',
    'DETALLE DEL ENVIO',
  ]);
});
