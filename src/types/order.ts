export interface NormalizedOrder {
  id: string;                     // id interno (Order.id)
  tiendaNubeOrderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  totalAmount: number;
  currency: string;

  customer: {
    firstName: string;
    lastName: string;
    fullName: string;
    email?: string;
    phone?: string;
    document?: string; // DNI / CUIT
  };

  shipTo: {
    street?: string;
    number?: string;
    floor?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country: string;
  };

  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    weightKg?: number;
  }>;

  shippingMethod?: string;
  labelGenerated: boolean;
}

export interface ShipmentPayload {
  order: NormalizedOrder;
  package: {
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  sender: {
    name: string;
    street: string;
    number: string;
    city: string;
    province: string;
    postalCode: string;
    phone: string;
    email: string;
  };
  service?: 'door_to_door' | 'pickup_point';
}

export interface ShipmentResult {
  carrier: 'CORREO_ARGENTINO' | 'SINERGIA' | 'MOCK';
  trackingNumber: string;
  externalShipmentId?: string;
  labelUrl?: string;
  labelPdfBytes?: Uint8Array;
  rawRequest: unknown;
  rawResponse: unknown;
}

export interface TrackingInfo {
  trackingNumber: string;
  status: string;
  events: Array<{ date: string; description: string; location?: string }>;
  raw: unknown;
}
