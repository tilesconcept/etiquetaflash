import { env } from '@/lib/env';
import { CarrierError } from '@/lib/errors';
import { logApiCall } from '@/lib/logger';
import { generateLabelPdf } from '@/lib/pdf';
import type { ShipmentPayload, ShipmentResult, TrackingInfo } from '@/types/order';
import type { ShippingProvider } from './shippingProvider';

// ============================================================================
// SinergiaService
//
// No se encontró documentación pública de Sinergia al momento de escribir
// este código. Este service implementa el contrato `ShippingProvider` con
// la misma forma que CorreoArgentinoService, pero todos los endpoints son
// PLACEHOLDER.
//
// === DÓNDE PEGAR INFORMACIÓN REAL ===
// 1) Pedir documentación a Sinergia (API REST esperada).
// 2) Reemplazar las constantes y endpoints marcados con TODO.
// 3) Adaptar `buildCreateRequest` / `parseCreateResponse` al shape real.
// 4) Cargar credenciales en .env (SINERGIA_*).
// ============================================================================

export class SinergiaService implements ShippingProvider {
  readonly name = 'SINERGIA' as const;

  isConfigured(): boolean {
    const cfg = env();
    return Boolean(cfg.SINERGIA_API_URL && cfg.SINERGIA_API_KEY);
  }

  validateShipmentData(payload: ShipmentPayload): string[] {
    // Misma validación base. Si Sinergia requiere campos extra (CUIT, sucursal,
    // tipo de servicio), agregarlos acá.
    const errors: string[] = [];
    const { order, package: pkg, sender } = payload;
    if (!order.customer.fullName?.trim()) errors.push('Falta nombre del destinatario');
    if (!order.shipTo.street?.trim()) errors.push('Falta calle de destino');
    if (!order.shipTo.city?.trim()) errors.push('Falta ciudad de destino');
    if (!order.shipTo.province?.trim()) errors.push('Falta provincia de destino');
    if (!order.shipTo.postalCode?.trim()) errors.push('Falta código postal de destino');
    if (!order.customer.phone?.trim()) errors.push('Falta teléfono del destinatario');
    if (!sender.postalCode?.trim()) errors.push('Falta CP de origen (configuración)');
    if (pkg.weightKg <= 0) errors.push('Peso del paquete inválido');
    return errors;
  }

  async createShipment(payload: ShipmentPayload): Promise<ShipmentResult> {
    const validationErrors = this.validateShipmentData(payload);
    if (validationErrors.length > 0) {
      throw new CarrierError(
        `Datos incompletos: ${validationErrors.join('; ')}`,
        this.name,
        validationErrors,
      );
    }

    if (env().MOCK_MODE || !this.isConfigured()) {
      return this.mockCreateShipment(payload);
    }

    // ============= TODO: endpoint real Sinergia =============
    const url = `${env().SINERGIA_API_URL}/PLACEHOLDER/shipments`;
    const requestBody = buildCreateRequest(payload);
    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: tipo de auth real.
          'X-Api-Key': env().SINERGIA_API_KEY ?? '',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      throw new CarrierError(
        `No se pudo conectar con Sinergia: ${(err as Error).message}`,
        this.name,
      );
    }

    const responseBody = await safeReadJson(res);
    await logApiCall({
      provider: 'sinergia',
      endpoint: url,
      method: 'POST',
      statusCode: res.status,
      requestBody,
      responseBody,
      durationMs: Date.now() - start,
      success: res.ok,
    });
    if (!res.ok) {
      throw new CarrierError(`Sinergia devolvió HTTP ${res.status}`, this.name, responseBody);
    }
    return parseCreateResponse(responseBody, requestBody);
  }

  async getLabel(trackingNumber: string): Promise<{ pdfBytes: Uint8Array; mimeType: string }> {
    if (env().MOCK_MODE || !this.isConfigured()) {
      throw new CarrierError('getLabel: usar createShipment en modo mock', this.name);
    }
    // ============= TODO: endpoint real =============
    const url = `${env().SINERGIA_API_URL}/PLACEHOLDER/shipments/${trackingNumber}/label`;
    const start = Date.now();
    const res = await fetch(url, {
      headers: { 'X-Api-Key': env().SINERGIA_API_KEY ?? '' },
    });
    await logApiCall({
      provider: 'sinergia',
      endpoint: url,
      method: 'GET',
      statusCode: res.status,
      durationMs: Date.now() - start,
      success: res.ok,
    });
    if (!res.ok) throw new CarrierError(`getLabel falló: HTTP ${res.status}`, this.name);
    return { pdfBytes: new Uint8Array(await res.arrayBuffer()), mimeType: 'application/pdf' };
  }

  async getTracking(trackingNumber: string): Promise<TrackingInfo> {
    if (env().MOCK_MODE || !this.isConfigured()) {
      return {
        trackingNumber,
        status: 'EN_TRANSITO',
        events: [{ date: new Date().toISOString(), description: 'Mock Sinergia' }],
        raw: null,
      };
    }
    // ============= TODO: endpoint real =============
    throw new CarrierError('getTracking no implementado todavía', this.name);
  }

  private async mockCreateShipment(payload: ShipmentPayload): Promise<ShipmentResult> {
    const trackingNumber = `SI${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const pdf = await generateLabelPdf({
      trackingNumber,
      carrier: 'SINERGIA',
      orderNumber: payload.order.orderNumber,
      recipient: {
        name: payload.order.customer.fullName,
        address: [payload.order.shipTo.street, payload.order.shipTo.number]
          .filter(Boolean)
          .join(' '),
        city: payload.order.shipTo.city ?? '',
        province: payload.order.shipTo.province ?? '',
        postalCode: payload.order.shipTo.postalCode ?? '',
        phone: payload.order.customer.phone,
        document: payload.order.customer.document,
      },
      sender: {
        name: payload.sender.name,
        address: `${payload.sender.street} ${payload.sender.number}`,
        city: payload.sender.city,
        province: payload.sender.province,
        postalCode: payload.sender.postalCode,
        phone: payload.sender.phone,
      },
      packageInfo: payload.package,
    });

    return {
      carrier: 'SINERGIA',
      trackingNumber,
      labelPdfBytes: pdf.bytes,
      rawRequest: { mock: true, orderNumber: payload.order.orderNumber },
      rawResponse: { mock: true, trackingNumber, labelPath: pdf.filePath },
    };
  }
}

function buildCreateRequest(payload: ShipmentPayload): Record<string, unknown> {
  // TODO: shape ilustrativo.
  return {
    client_id: env().SINERGIA_CLIENT_ID,
    reference: payload.order.orderNumber,
    sender: payload.sender,
    recipient: {
      name: payload.order.customer.fullName,
      phone: payload.order.customer.phone,
      email: payload.order.customer.email,
      document: payload.order.customer.document,
      address: payload.order.shipTo,
    },
    package: payload.package,
  };
}

function parseCreateResponse(responseBody: unknown, requestBody: unknown): ShipmentResult {
  const r = responseBody as { tracking?: string; label_url?: string };
  if (!r?.tracking) {
    throw new CarrierError('Respuesta Sinergia sin tracking', 'SINERGIA', responseBody);
  }
  return {
    carrier: 'SINERGIA',
    trackingNumber: r.tracking,
    labelUrl: r.label_url,
    rawRequest: requestBody,
    rawResponse: responseBody,
  };
}

async function safeReadJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return await res.text().catch(() => null);
  }
}
