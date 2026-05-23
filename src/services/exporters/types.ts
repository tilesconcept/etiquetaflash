import type { Order } from '@prisma/client';

export interface ExporterOutput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  rowCount: number;
}

export interface ExportContext {
  defaultProductType: string;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  defaultWeightKg: number;
  defaultContentValue: number;
  defaultFlexId: string;
}

export type OrderRow = Order;
