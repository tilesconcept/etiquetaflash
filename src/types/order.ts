// Datos extraídos de un PDF de Tienda Nube.
// Lo que el parser no encuentra queda undefined y la UI lo pinta como editable.
export interface ParsedLabel {
  orderNumber: string;
  packageNumber?: string;
  date?: string;
  carrier: 'CORREO_ARGENTINO' | 'SINERGIA' | 'OTRO';
  shippingMode: 'HOME' | 'PICKUP_BRANCH';

  // Si es PICKUP_BRANCH
  pickupBranchName?: string;
  pickupBranchAddress?: string;
  pickupBranchCode?: string; // si el parser lo pudo inferir

  // Destinatario
  recipientName?: string;
  recipientPhone?: string;
  recipientDni?: string;
  recipientEmail?: string;

  // Dirección de entrega (HOME) — y también copia desde la sucursal para
  // que las columnas localidad/provincia/CP queden completas.
  shipStreet?: string;
  shipNumber?: string;
  shipFloor?: string;
  shipApartment?: string;
  shipLocality?: string;
  shipProvince?: string;
  shipPostalCode?: string;

  productsSummary?: string;
  productsJson?: Array<{ name: string; quantity: number; sku?: string }>;

  rawText: string;
}
