import ExcelJS from 'exceljs';
import type { ExportContext, ExporterOutput, OrderRow } from './types';

// Columnas del formulario bulk de Sinergia (https://sinergiasoftware.xyz/clients/bulk-add/).
// "ID FLEX", "DOMICILIO", "LOCALIDAD" son obligatorias (resaltadas en azul).
export const SINERGIA_HEADERS = [
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
] as const;

export interface SinergiaRow {
  idFlex: string;
  domicilio: string;
  entrecalles?: string;
  codigoPostal?: string;
  localidad: string;
  partido?: string;
  destinatario: string;
  dniDestinatario?: string;
  telefonoDestinatario?: string;
  detalleDelEnvio?: string;
}

export function orderToSinergiaRow(o: OrderRow, ctx: ExportContext): SinergiaRow {
  // DOMICILIO = "Calle 123 Piso 5 Dto A". Sinergia no separa altura/calle.
  const domicilio = [
    [o.shipStreet, o.shipNumber].filter(Boolean).join(' '),
    o.shipFloor ? `Piso ${o.shipFloor}` : '',
    o.shipApartment ? `Dto ${o.shipApartment}` : '',
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(' ')
    .trim();

  // Si DETALLE DEL ENVIO va vacío para paquetes < 5kg (según la ayuda del form).
  const weight = o.weightKg ?? ctx.defaultWeightKg;
  const detalle = o.shipmentDetail ?? (weight && weight >= 5 ? o.productsSummary ?? undefined : undefined);

  return {
    idFlex: o.flexId ?? ctx.defaultFlexId ?? 'flex',
    domicilio,
    entrecalles: o.shipBetweenStreets ?? undefined,
    codigoPostal: o.shipPostalCode ?? undefined,
    localidad: o.shipLocality ?? '',
    partido: o.shipPartido ?? undefined,
    destinatario: o.recipientName,
    dniDestinatario: o.recipientDni ?? undefined,
    telefonoDestinatario: o.recipientPhone ?? undefined,
    detalleDelEnvio: detalle ?? undefined,
  };
}

export async function exportSinergia(orders: OrderRow[], ctx: ExportContext): Promise<ExporterOutput> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EtiquetaFlash';
  wb.created = new Date();
  const ws = wb.addWorksheet('envios');

  ws.columns = SINERGIA_HEADERS.map((h) => ({ header: h, key: h, width: 22 }));
  // Resaltar obligatorias en azul claro (ID FLEX, DOMICILIO, LOCALIDAD).
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  const obligatoryHeaders = new Set(['ID FLEX', 'DOMICILIO', 'LOCALIDAD']);
  headerRow.eachCell((cell, col) => {
    const h = SINERGIA_HEADERS[col - 1];
    if (obligatoryHeaders.has(h)) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD0E4FF' },
      };
    }
  });

  for (const o of orders) {
    const r = orderToSinergiaRow(o, ctx);
    ws.addRow({
      'ID FLEX': r.idFlex,
      DOMICILIO: r.domicilio,
      ENTRECALLES: r.entrecalles ?? '',
      'CODIGO POSTAL': r.codigoPostal ?? '',
      LOCALIDAD: r.localidad,
      PARTIDO: r.partido ?? '',
      DESTINATARIO: r.destinatario,
      'DNI DESTINATARIO': r.dniDestinatario ?? '',
      'TELEFONO DESTINATARIO': r.telefonoDestinatario ?? '',
      'DETALLE DEL ENVIO': r.detalleDelEnvio ?? '',
    });
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    fileName: `sinergia-carga-masiva-${stamp()}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rowCount: orders.length,
  };
}

export function validateForSinergia(orders: OrderRow[], ctx: ExportContext): string[] {
  const issues: string[] = [];
  for (const o of orders) {
    const r = orderToSinergiaRow(o, ctx);
    const id = `#${o.orderNumber}`;
    if (!r.idFlex?.trim()) issues.push(`${id}: ID FLEX vacío (obligatorio en Sinergia)`);
    if (!r.domicilio?.trim()) issues.push(`${id}: DOMICILIO vacío (obligatorio)`);
    if (!r.localidad?.trim()) issues.push(`${id}: LOCALIDAD vacía (obligatoria)`);
    if (!r.destinatario?.trim()) issues.push(`${id}: DESTINATARIO vacío`);
    if (o.shippingMode === 'PICKUP_BRANCH') {
      issues.push(`${id}: es retiro en sucursal; Sinergia no maneja sucursales, marcalo como HOME o cambialo a Correo Argentino`);
    }
  }
  return issues;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
