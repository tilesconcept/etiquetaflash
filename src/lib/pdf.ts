import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const LABELS_DIR = path.join(process.cwd(), 'storage', 'labels');

export interface LabelData {
  trackingNumber: string;
  carrier: string;
  recipient: {
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    phone?: string;
    document?: string;
  };
  sender: {
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    phone?: string;
  };
  packageInfo: {
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  orderNumber: string;
}

// Genera una etiqueta PDF "estilo postal" de 10x15cm.
// NOTA: cuando el carrier devuelva PDF/ZPL nativo, este generador se usa solo
//       como fallback. Ver ShippingProvider.getLabel().
export async function generateLabelPdf(data: LabelData): Promise<{ filePath: string; bytes: Uint8Array }> {
  const doc = await PDFDocument.create();
  // 10x15cm en puntos (1cm ≈ 28.346 pt)
  const W = 283.46;
  const H = 425.2;
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const drawText = (text: string, x: number, y: number, size = 8, bold = false) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: black });
  };

  // Cabecera
  drawText(data.carrier.toUpperCase(), 8, H - 18, 12, true);
  drawText(`Pedido #${data.orderNumber}`, W - 100, H - 18, 9, true);

  page.drawLine({ start: { x: 8, y: H - 24 }, end: { x: W - 8, y: H - 24 }, thickness: 1, color: black });

  // Remitente
  drawText('REMITENTE', 8, H - 38, 7, true);
  drawText(data.sender.name, 8, H - 50, 8);
  drawText(`${data.sender.address}`, 8, H - 62, 8);
  drawText(`${data.sender.city}, ${data.sender.province} (CP ${data.sender.postalCode})`, 8, H - 74, 8);

  page.drawLine({ start: { x: 8, y: H - 84 }, end: { x: W - 8, y: H - 84 }, thickness: 0.5, color: black });

  // Destinatario
  drawText('DESTINATARIO', 8, H - 98, 7, true);
  drawText(data.recipient.name, 8, H - 112, 11, true);
  drawText(data.recipient.address, 8, H - 126, 9);
  drawText(`${data.recipient.city}, ${data.recipient.province}`, 8, H - 140, 9);
  drawText(`CP ${data.recipient.postalCode}`, 8, H - 154, 10, true);
  if (data.recipient.phone) drawText(`Tel: ${data.recipient.phone}`, 8, H - 168, 8);
  if (data.recipient.document) drawText(`Doc: ${data.recipient.document}`, 8, H - 180, 8);

  // Paquete
  page.drawLine({ start: { x: 8, y: H - 200 }, end: { x: W - 8, y: H - 200 }, thickness: 0.5, color: black });
  drawText(
    `Peso: ${data.packageInfo.weightKg}kg · ${data.packageInfo.lengthCm}x${data.packageInfo.widthCm}x${data.packageInfo.heightCm}cm`,
    8,
    H - 214,
    8,
  );

  // Tracking
  page.drawRectangle({ x: 8, y: 40, width: W - 16, height: 60, borderColor: black, borderWidth: 1 });
  drawText('TRACKING', 14, 90, 7, true);
  drawText(data.trackingNumber, 14, 60, 14, true);

  // Pie
  drawText('EtiquetaFlash · Tiles Concept', 8, 14, 6);

  const bytes = await doc.save();

  await fs.mkdir(LABELS_DIR, { recursive: true });
  const fileName = `${data.carrier.toLowerCase()}-${data.trackingNumber}-${Date.now()}.pdf`;
  const filePath = path.join(LABELS_DIR, fileName);
  await fs.writeFile(filePath, bytes);

  return { filePath, bytes };
}

export function labelsDir(): string {
  return LABELS_DIR;
}
