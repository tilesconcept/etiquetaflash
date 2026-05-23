import { getDocumentProxy } from 'unpdf';
import type { ParsedLabel } from '@/types/order';
import { provinceCodeFromCpa, resolveProvinceCode } from '@/lib/argentinaProvinces';

// Parsea uno o varios PDFs de etiquetas de Tienda Nube.
// Tolerante: cada etiqueta TN imprime dos mitades (rótulo + recibo del cliente)
// con el mismo encabezado "Orden #X - Paquete #Y". Tomamos solo la mitad-rótulo
// (la que tiene "Entregar a:" / dirección).
export async function parseTiendaNubePdf(
  fileBuffer: ArrayBuffer | Uint8Array,
  _fileName?: string,
): Promise<ParsedLabel[]> {
  const data = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);
  const pdf = await getDocumentProxy(data);
  const allLines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = reconstructLines(content.items as PdfTextItem[]);
    allLines.push(...lines);
    allLines.push(''); // separa páginas
  }
  return splitAndParse(allLines.join('\n'));
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

// Reconstruye líneas a partir de los text items de pdfjs.
// pdfjs entrega items con (x, y) — la Y baja a medida que se desciende en la página
// en coords PDF (origen abajo-izquierda). Agrupamos por Y (con tolerancia) y
// dentro de cada grupo ordenamos por X.
function reconstructLines(items: PdfTextItem[]): string[] {
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  const tolerance = 3; // px de tolerancia para considerar misma línea
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    const existing = groups.find((g) => Math.abs(g.y - y) <= tolerance);
    if (existing) existing.items.push(it);
    else groups.push({ y, items: [it] });
  }
  groups.sort((a, b) => b.y - a.y);
  return groups.map((g) =>
    g.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((i) => i.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

// Exportado para tests.
export function splitAndParse(fullText: string, fileName?: string): ParsedLabel[] {
  // Reemplazar tabs/runs de espacios por single space; pero mantener saltos de línea.
  const text = fullText.replace(/\r/g, '').replace(/[ \t]+/g, ' ');

  const blocks = splitByOrderHeader(text);
  const seen = new Set<string>();
  const out: ParsedLabel[] = [];
  for (const block of blocks) {
    // Descartar la mitad "Datos de quien retira" (recibo).
    if (/Datos de quien retira/i.test(block.body)) continue;
    // Heurística mínima: debe haber un "Entregar a:" o una dirección.
    if (!/Entregar a:|Dirección de (retiro|envío)/i.test(block.body)) continue;

    const key = `${block.orderNumber}-${block.packageNumber ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const parsed = parseBlock(block.orderNumber, block.packageNumber, block.body);
    parsed.rawText = block.body.trim();
    if (fileName) {
      // El llamador lo guarda en sourceFileName.
    }
    out.push(parsed);
  }
  return out;
}

interface Block {
  orderNumber: string;
  packageNumber?: string;
  body: string;
}

function splitByOrderHeader(text: string): Block[] {
  const re = /Orden\s*#(\d+)\s*-\s*Paquete\s*#(\d+)/g;
  const matches: Array<{ index: number; orderNumber: string; packageNumber: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    matches.push({ index: m.index, orderNumber: m[1], packageNumber: m[2] });
  }
  if (matches.length === 0) return [];
  const blocks: Block[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks.push({
      orderNumber: matches[i].orderNumber,
      packageNumber: matches[i].packageNumber,
      body: text.slice(start, end),
    });
  }
  return blocks;
}

function parseBlock(orderNumber: string, packageNumber: string | undefined, body: string): ParsedLabel {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const get = (re: RegExp): string | undefined => {
    const m = body.match(re);
    return m ? m[1].trim() : undefined;
  };

  const date = get(/Realizada el\s+(\d{2}\/\d{2}\/\d{4})/);
  const recipientName = get(/Entregar a:\s*(.+)/);
  const recipientPhone = get(/Tel[eé]fono:\s*([+\d().\- ]+)/);
  const recipientDni = get(/DNI:\s*([\d.]+)/);
  const recipientEmail = get(/Email:\s*([^\s]+@[^\s]+)/);

  // Detectar modo de envío.
  const isPickup = /Dirección de retiro:/i.test(body);
  const isHome = /Dirección de envío:/i.test(body);
  const shippingMode: ParsedLabel['shippingMode'] = isPickup ? 'PICKUP_BRANCH' : 'HOME';

  // Línea inmediatamente después de "Dirección de retiro/envío:" suele tener el carrier
  // (ej. "Correo Argentino Clasico - USHUAIA" o "Sinergia Domicilio").
  const addressBlockLines = sliceAfter(
    lines,
    isPickup ? /Dirección de retiro:/i : isHome ? /Dirección de envío:/i : /Dirección de (retiro|envío):/i,
    (l) => /^(Entregar a:|Remitente:|Teléfono:|DNI:|Email:)/i.test(l),
  );

  const carrierLine = addressBlockLines[0] ?? '';
  let carrier: ParsedLabel['carrier'] = 'OTRO';
  if (/correo\s*argentino/i.test(carrierLine)) carrier = 'CORREO_ARGENTINO';
  else if (/sinergia/i.test(carrierLine)) carrier = 'SINERGIA';

  // Sucursal de retiro: nombre = primera línea sin "Correo Argentino" prefix;
  // dirección = siguientes líneas hasta antes de la línea "CIUDAD, Provincia, CP".
  let pickupBranchName: string | undefined;
  let pickupBranchAddress: string | undefined;

  let shipLocality: string | undefined;
  let shipProvince: string | undefined;
  let shipPostalCode: string | undefined;
  let shipStreet: string | undefined;
  let shipNumber: string | undefined;
  let shipFloor: string | undefined;
  let shipApartment: string | undefined;

  // Detectar la línea "LOCALIDAD, Provincia, CP" (con coma).
  const cityProvCpRe = /^(.+?),\s*(.+?),\s*([A-Z]\d{4}[A-Z]{3}|\d{4})\s*$/;
  let cityIdx = -1;
  for (let i = 0; i < addressBlockLines.length; i++) {
    const mm = addressBlockLines[i].match(cityProvCpRe);
    if (mm) {
      cityIdx = i;
      shipLocality = mm[1].trim();
      shipProvince = mm[2].trim();
      shipPostalCode = mm[3].trim();
      break;
    }
  }

  if (shippingMode === 'PICKUP_BRANCH') {
    pickupBranchName = carrierLine || undefined;
    if (cityIdx > 1) {
      pickupBranchAddress = addressBlockLines.slice(1, cityIdx).join(' · ');
    } else if (addressBlockLines.length > 1) {
      pickupBranchAddress = addressBlockLines.slice(1, Math.max(2, addressBlockLines.length - 0)).join(' · ');
    }
  } else {
    // HOME: línea 1 = carrier (ej "Sinergia"); líneas 2..cityIdx-1 = dirección.
    const streetLines = cityIdx > 1 ? addressBlockLines.slice(1, cityIdx) : [];
    if (streetLines.length > 0) {
      const streetLine = streetLines[0];
      const parsedStreet = parseStreetLine(streetLine);
      shipStreet = parsedStreet.street;
      shipNumber = parsedStreet.number;
      if (streetLines[1]) {
        const fa = parseFloorApt(streetLines[1]);
        shipFloor = fa.floor;
        shipApartment = fa.apartment;
      }
    }
  }

  // Productos: bloque "Producto ... Cant." seguido de líneas con cantidad al final.
  const products = parseProducts(body);
  const productsSummary = products.length
    ? products.map((p) => `${p.name} x${p.quantity}`).join(' · ')
    : undefined;

  return {
    orderNumber,
    packageNumber,
    date,
    carrier,
    shippingMode,
    pickupBranchName,
    pickupBranchAddress,
    recipientName,
    recipientPhone,
    recipientDni,
    recipientEmail,
    shipStreet,
    shipNumber,
    shipFloor,
    shipApartment,
    shipLocality,
    shipProvince,
    shipPostalCode,
    productsSummary,
    productsJson: products,
    rawText: '',
  };
}

function sliceAfter(lines: string[], startRe: RegExp, stopFn: (l: string) => boolean): string[] {
  const i = lines.findIndex((l) => startRe.test(l));
  if (i === -1) return [];
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (stopFn(lines[j])) break;
    out.push(lines[j]);
  }
  return out;
}

function parseStreetLine(line: string): { street?: string; number?: string } {
  // "AV GRAL SAN MARTIN 309" → street="AV GRAL SAN MARTIN", number="309"
  const m = line.match(/^(.*?)\s+(\d+\w?)\s*$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  return { street: line.trim() };
}

function parseFloorApt(line: string): { floor?: string; apartment?: string } {
  // Ejemplos: "PB", "5B", "Piso 3 Dto A", "5° A"
  const lower = line.toLowerCase();
  if (/^pb\b/.test(lower)) return { floor: 'PB' };
  const m = line.match(/(?:piso\s*)?(\d+\w?)\s*(?:dto\.?|depto\.?|departamento|°)?\s*([A-Za-z0-9]+)?/i);
  if (m) return { floor: m[1], apartment: m[2] };
  return { floor: line };
}

function parseProducts(body: string): Array<{ name: string; quantity: number; sku?: string }> {
  // Tomar el bloque entre "Producto ... Cant." y "Subtotal".
  const tableMatch = body.match(/Producto\s+Cant\.?\s*([\s\S]*?)Subtotal/i);
  if (!tableMatch) return [];
  const table = tableMatch[1];
  const lines = table
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const products: Array<{ name: string; quantity: number; sku?: string }> = [];
  let current: { name: string; quantity: number; sku?: string } | null = null;
  for (const line of lines) {
    const skuM = line.match(/^SKU:\s*(.+)$/i);
    if (skuM && current) {
      current.sku = skuM[1].trim();
      continue;
    }
    // Línea de producto: "NOMBRE                Cant"
    const m = line.match(/^(.+?)\s+(\d+)$/);
    if (m) {
      if (current) products.push(current);
      current = { name: m[1].trim(), quantity: Number(m[2]) };
    }
  }
  if (current) products.push(current);
  return products;
}

// Helper público: dado un ParsedLabel, devuelve el ProvinceCode CA inferido
// (preferencia: CPA > nombre).
export function inferProvinceCode(label: ParsedLabel): string | undefined {
  return provinceCodeFromCpa(label.shipPostalCode) ?? resolveProvinceCode(label.shipProvince);
}
