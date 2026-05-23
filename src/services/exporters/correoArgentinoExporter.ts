import type { ExportContext, ExporterOutput, OrderRow } from './types';
import { resolveProvinceCode, provinceCodeFromCpa } from '@/lib/argentinaProvinces';

// Columnas EXACTAS de la plantilla oficial Correo Argentino · carga masiva.
// Fuente: archivo "Plantilla_Carga_Masiva.csv" provisto por el usuario.
// Separador: ";". Codificación: UTF-8 (con BOM para que Excel detecte).
export const CORREO_AR_HEADERS = [
  'tipo_producto(obligatorio)',
  'largo(obligatorio en CM)',
  'ancho(obligatorio en CM)',
  'altura(obligatorio en CM)',
  'peso(obligatorio en KG)',
  'valor_del_contenido(obligatorio en pesos argentinos)',
  'provincia_destino(obligatorio)',
  'sucursal_destino(obligatorio solo en caso de no ingresar localidad de destino)',
  'localidad_destino(obligatorio solo en caso de no ingresar sucursal de destino)',
  'calle_destino(obligatorio solo en caso de no ingresar sucursal de destino)',
  'altura_destino(obligatorio solo en caso de no ingresar sucursal de destino)',
  'piso(opcional solo en caso de no ingresar sucursal de destino)',
  'dpto(opcional solo en caso de no ingresar sucursal de destino)',
  'codpostal_destino(obligatorio solo en caso de no ingresar sucursal de destino)',
  'destino_nombre(obligatorio)',
  'destino_email(obligatorio, debe ser un email valido)',
  'cod_area_tel(opcional)',
  'tel(opcional)',
  'cod_area_cel(obligatorio)',
  'cel(obligatorio)',
  'numero_orden(opcional)',
] as const;

export interface CorreoArRow {
  tipoProducto: string;
  largoCm: number;
  anchoCm: number;
  alturaCm: number;
  pesoKg: number;
  valorContenido: number;
  provinciaCode: string;          // 1 letra
  sucursalCode?: string;
  localidad?: string;
  calle?: string;
  altura?: string;
  piso?: string;
  dpto?: string;
  codPostal?: string;
  destinoNombre: string;
  destinoEmail: string;
  codAreaTel?: string;
  tel?: string;
  codAreaCel: string;
  cel: string;
  numeroOrden?: string;
}

export function orderToCorreoArRow(o: OrderRow, ctx: ExportContext): CorreoArRow {
  const isPickup = o.shippingMode === 'PICKUP_BRANCH';
  const provinciaCode =
    o.shipProvinceCode ??
    provinceCodeFromCpa(o.shipPostalCode) ??
    resolveProvinceCode(o.shipProvince) ??
    '';

  const { areaCode, number } = splitPhone(o.recipientPhoneAreaCode, o.recipientPhoneNumber, o.recipientPhone);

  return {
    tipoProducto: o.productType ?? ctx.defaultProductType,
    largoCm: o.lengthCm ?? ctx.defaultLengthCm,
    anchoCm: o.widthCm ?? ctx.defaultWidthCm,
    alturaCm: o.heightCm ?? ctx.defaultHeightCm,
    pesoKg: o.weightKg ?? ctx.defaultWeightKg,
    valorContenido: o.contentValue ?? ctx.defaultContentValue,
    provinciaCode,
    sucursalCode: isPickup ? (o.pickupBranchCode ?? undefined) : undefined,
    localidad: isPickup ? undefined : (o.shipLocality ?? undefined),
    calle: isPickup ? undefined : (o.shipStreet ?? undefined),
    altura: isPickup ? undefined : (o.shipNumber ?? undefined),
    piso: isPickup ? undefined : (o.shipFloor ?? undefined),
    dpto: isPickup ? undefined : (o.shipApartment ?? undefined),
    codPostal: isPickup ? undefined : (o.shipPostalCode ?? undefined),
    destinoNombre: o.recipientName,
    destinoEmail: o.recipientEmail ?? '',
    codAreaTel: undefined,
    tel: undefined,
    codAreaCel: areaCode,
    cel: number,
    numeroOrden: o.orderNumber,
  };
}

export function rowToValues(r: CorreoArRow): string[] {
  return [
    r.tipoProducto,
    String(r.largoCm),
    String(r.anchoCm),
    String(r.alturaCm),
    String(r.pesoKg),
    String(r.valorContenido),
    r.provinciaCode,
    r.sucursalCode ?? '',
    r.localidad ?? '',
    r.calle ?? '',
    r.altura ?? '',
    r.piso ?? '',
    r.dpto ?? '',
    r.codPostal ?? '',
    r.destinoNombre,
    r.destinoEmail,
    r.codAreaTel ?? '',
    r.tel ?? '',
    r.codAreaCel,
    r.cel,
    r.numeroOrden ?? '',
  ];
}

export function exportCorreoArgentino(orders: OrderRow[], ctx: ExportContext): ExporterOutput {
  const BOM = '﻿';
  const sep = ';';
  const lines = [CORREO_AR_HEADERS.join(sep)];
  for (const o of orders) {
    const row = orderToCorreoArRow(o, ctx);
    lines.push(rowToValues(row).map(escapeCsvCell).join(sep));
  }
  const csv = BOM + lines.join('\r\n') + '\r\n';
  return {
    buffer: Buffer.from(csv, 'utf8'),
    fileName: `correo-argentino-carga-masiva-${stamp()}.csv`,
    mimeType: 'text/csv; charset=utf-8',
    rowCount: orders.length,
  };
}

// Validación previa: devuelve errores por fila ("Pedido #X: falta email"...).
export function validateForCorreoArgentino(orders: OrderRow[], ctx: ExportContext): string[] {
  const issues: string[] = [];
  for (const o of orders) {
    const row = orderToCorreoArRow(o, ctx);
    const id = `#${o.orderNumber}`;
    if (!row.provinciaCode) issues.push(`${id}: falta código de provincia (no se pudo inferir)`);
    if (!row.destinoNombre?.trim()) issues.push(`${id}: falta nombre del destinatario`);
    if (!row.destinoEmail?.trim()) issues.push(`${id}: falta email del destinatario (obligatorio en CA)`);
    if (!isEmail(row.destinoEmail)) issues.push(`${id}: email inválido (${row.destinoEmail || 'vacío'})`);
    if (!row.codAreaCel || !row.cel) issues.push(`${id}: falta celular (cod_area_cel + cel)`);
    if (!row.sucursalCode && !(row.localidad && row.calle && row.altura && row.codPostal)) {
      issues.push(`${id}: si no es retiro en sucursal, faltan localidad/calle/altura/CP`);
    }
    if (!row.largoCm || !row.anchoCm || !row.alturaCm || !row.pesoKg) {
      issues.push(`${id}: faltan dimensiones o peso del paquete`);
    }
  }
  return issues;
}

// -------- Helpers --------

function escapeCsvCell(v: string): string {
  // El separador es ;, escapamos según RFC 4180 cuando hay ; / " / \n.
  if (v == null) return '';
  const needsQuote = /[";\r\n]/.test(v);
  const inner = v.replace(/"/g, '""');
  return needsQuote ? `"${inner}"` : inner;
}

function isEmail(v?: string | null): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// Separa "+54 9 11 4567-8901" → { areaCode: "11", number: "45678901" }.
// Si el usuario ya cargó las partes separadas, las usa tal cual.
export function splitPhone(
  areaPart?: string | null,
  numberPart?: string | null,
  fullPhone?: string | null,
): { areaCode: string; number: string } {
  if (areaPart && numberPart) return { areaCode: areaPart, number: numberPart };
  const raw = (fullPhone ?? '').replace(/[^\d]/g, '');
  if (!raw) return { areaCode: '', number: '' };
  // Quitar prefijo país +54 y el "9" de móviles AR si están.
  let digits = raw;
  if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.startsWith('9')) digits = digits.slice(1);
  // Heurística: en AR el código de área varía (2 a 4 dígitos).
  // Si tiene 10 dígitos: 2 area + 8 número (caso CABA 11) o 3+7 / 4+6.
  // Para CABA (11) usamos 2. Para el resto asumimos 3 (es el más común).
  if (digits.length >= 10) {
    const areaLen = digits.startsWith('11') ? 2 : 3;
    return { areaCode: digits.slice(0, areaLen), number: digits.slice(areaLen) };
  }
  if (digits.length >= 8) {
    return { areaCode: digits.slice(0, digits.length - 8), number: digits.slice(-8) };
  }
  return { areaCode: '', number: digits };
}
