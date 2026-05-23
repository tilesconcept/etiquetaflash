import { env } from '@/lib/env';
import { logApiCall } from '@/lib/logger';
import { NotConfiguredError } from '@/lib/errors';
import { mockOrders } from '@/mocks/orders';
import type { NormalizedOrder } from '@/types/order';
import type { TiendaNubeOrder } from '@/types/tiendanube';

// ============================================================
// Tienda Nube / Nuvemshop API client
// Docs: https://dev.tiendanube.com/docs/api
//
// Base URL: https://api.tiendanube.com/v1/{store_id}
// Header obligatorio: Authentication: bearer <access_token>
//                    User-Agent: NombreApp (email-contacto)
// ============================================================

const TIENDANUBE_API_BASE = 'https://api.tiendanube.com/v1';
const TIENDANUBE_OAUTH_TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';

interface TiendaNubeAuthOptions {
  storeId: string;
  accessToken: string;
}

export class TiendaNubeService {
  private storeId?: string;
  private accessToken?: string;

  constructor(auth?: TiendaNubeAuthOptions) {
    this.storeId = auth?.storeId;
    this.accessToken = auth?.accessToken;
  }

  isMock(): boolean {
    return env().MOCK_MODE || !this.storeId || !this.accessToken;
  }

  // ---------------------------------------------------------------
  // OAuth: intercambiar `code` por `access_token`.
  // POST https://www.tiendanube.com/apps/authorize/token
  // body: { client_id, client_secret, grant_type: 'authorization_code', code }
  // ---------------------------------------------------------------
  static async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    user_id: number;
    scope: string;
  }> {
    const cfg = env();
    if (!cfg.TIENDANUBE_APP_ID || !cfg.TIENDANUBE_CLIENT_SECRET) {
      throw new NotConfiguredError('Tienda Nube');
    }

    const start = Date.now();
    const res = await fetch(TIENDANUBE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.TIENDANUBE_APP_ID,
        client_secret: cfg.TIENDANUBE_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const json = await res.json();
    await logApiCall({
      provider: 'tiendanube',
      endpoint: TIENDANUBE_OAUTH_TOKEN_URL,
      method: 'POST',
      statusCode: res.status,
      requestBody: { code: '[REDACTED]' },
      responseBody: json,
      durationMs: Date.now() - start,
      success: res.ok,
    });
    if (!res.ok) {
      throw new Error(`OAuth Tienda Nube falló: ${res.status}`);
    }
    return json as { access_token: string; user_id: number; scope: string };
  }

  // ---------------------------------------------------------------
  // GET /v1/{store_id}/orders?payment_status=paid&shipping_status=unpacked
  // ---------------------------------------------------------------
  async listPendingOrders(): Promise<NormalizedOrder[]> {
    if (this.isMock()) {
      return mockOrders;
    }
    const raws = await this.request<TiendaNubeOrder[]>(
      `/orders?payment_status=paid&shipping_status=unpacked&per_page=50`,
    );
    return raws.map(normalizeOrder);
  }

  // ---------------------------------------------------------------
  // GET /v1/{store_id}/orders/{id}
  // ---------------------------------------------------------------
  async getOrder(orderId: string | number): Promise<NormalizedOrder> {
    if (this.isMock()) {
      const found = mockOrders.find((o) => o.tiendaNubeOrderId === String(orderId));
      if (!found) throw new Error(`Pedido mock ${orderId} no encontrado`);
      return found;
    }
    const raw = await this.request<TiendaNubeOrder>(`/orders/${orderId}`);
    return normalizeOrder(raw);
  }

  // ---------------------------------------------------------------
  // PUT /v1/{store_id}/orders/{id}
  // Doc: actualiza tracking. Verificar el shape vigente en
  // https://dev.tiendanube.com/docs/api/resources/order
  // ---------------------------------------------------------------
  async updateOrderTracking(
    orderId: string | number,
    tracking: { number: string; url?: string; carrier?: string },
  ): Promise<void> {
    if (this.isMock()) return;
    await this.request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        shipping_tracking_number: tracking.number,
        shipping_tracking_url: tracking.url,
        shipping_carrier_name: tracking.carrier,
      }),
    });
  }

  // ---------------------------------------------------------------
  // Helper interno: requests autenticados
  // ---------------------------------------------------------------
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.storeId || !this.accessToken) throw new NotConfiguredError('Tienda Nube');

    const url = `${TIENDANUBE_API_BASE}/${this.storeId}${path}`;
    const start = Date.now();
    const res = await fetch(url, {
      ...init,
      headers: {
        Authentication: `bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': env().TIENDANUBE_USER_AGENT ?? 'EtiquetaFlash (admin@tilesconceptar.com)',
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? safeJsonParse(text) : null;
    await logApiCall({
      provider: 'tiendanube',
      endpoint: path,
      method: init?.method ?? 'GET',
      statusCode: res.status,
      requestBody: init?.body ?? null,
      responseBody: body,
      durationMs: Date.now() - start,
      success: res.ok,
      errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
    });
    if (!res.ok) {
      throw new Error(`Tienda Nube ${path} → HTTP ${res.status}`);
    }
    return body as T;
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function normalizeOrder(raw: TiendaNubeOrder): NormalizedOrder {
  const fullName = raw.contact_name ?? raw.customer?.name ?? raw.shipping_address?.name ?? '';
  const [firstName = '', ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  return {
    id: '', // se completa al persistir
    tiendaNubeOrderId: String(raw.id),
    orderNumber: String(raw.number),
    status: raw.status,
    paymentStatus: raw.payment_status,
    shippingStatus: raw.shipping_status ?? 'unpacked',
    totalAmount: Number(raw.total ?? 0),
    currency: raw.currency ?? 'ARS',
    customer: {
      firstName,
      lastName,
      fullName,
      email: raw.contact_email ?? raw.customer?.email,
      phone: raw.contact_phone ?? raw.customer?.phone ?? raw.shipping_address?.phone,
      document: raw.contact_identification ?? raw.customer?.identification,
    },
    shipTo: {
      street: raw.shipping_address?.address,
      number: raw.shipping_address?.number,
      floor: raw.shipping_address?.floor,
      city: raw.shipping_address?.city ?? raw.shipping_address?.locality,
      province: raw.shipping_address?.province,
      postalCode: raw.shipping_address?.zipcode,
      country: raw.shipping_address?.country ?? 'AR',
    },
    items: (raw.products ?? []).map((p) => ({
      name: p.name,
      sku: p.sku,
      quantity: p.quantity,
      unitPrice: Number(p.price ?? 0),
      weightKg: p.weight ? Number(p.weight) : undefined,
    })),
    shippingMethod: raw.shipping_option,
    labelGenerated: false,
  };
}
