// Shape parcial de la respuesta de Nuvemshop /v1/{store}/orders.
// Doc: https://dev.tiendanube.com/docs/api
// Mantengo solo los campos que consumimos; el resto queda en `raw`.
export interface TiendaNubeOrder {
  id: number;
  number: number;
  status: string;
  payment_status: string;
  shipping_status: string | null;
  shipping_option?: string;
  shipping_pickup_type?: string;
  shipping_min_days?: number;
  shipping_max_days?: number;
  total: string;
  currency: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_identification?: string;
  created_at?: string;

  customer?: {
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    identification?: string;
  };

  shipping_address?: {
    address?: string;
    number?: string;
    floor?: string;
    locality?: string;
    city?: string;
    province?: string;
    zipcode?: string;
    country?: string;
    phone?: string;
    name?: string;
  };

  billing_address?: Record<string, unknown>;

  products: Array<{
    id: number;
    name: string;
    sku?: string;
    quantity: number;
    price: string;
    weight?: string;
  }>;
}
