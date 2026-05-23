import type { ShipmentPayload, ShipmentResult, TrackingInfo } from '@/types/order';

// Contrato común que CorreoArgentino y Sinergia deben implementar.
// Mantener esta interfaz estable: el orquestador y la UI dependen de ella.
export interface ShippingProvider {
  readonly name: 'CORREO_ARGENTINO' | 'SINERGIA' | 'MOCK';

  isConfigured(): boolean;

  // Valida que el payload tenga lo mínimo para crear el envío en este carrier.
  // Devuelve lista de errores (vacía si OK).
  validateShipmentData(payload: ShipmentPayload): string[];

  createShipment(payload: ShipmentPayload): Promise<ShipmentResult>;

  // Recupera la etiqueta PDF. Si el carrier la incluye en createShipment,
  // este método puede devolver lo mismo.
  getLabel(trackingNumber: string): Promise<{ pdfBytes: Uint8Array; mimeType: string }>;

  getTracking(trackingNumber: string): Promise<TrackingInfo>;
}
