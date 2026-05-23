import { env } from '@/lib/env';
import { CarrierError, NotConfiguredError } from '@/lib/errors';
import { logApiCall } from '@/lib/logger';
import { generateLabelPdf } from '@/lib/pdf';
import type { ShipmentPayload, ShipmentResult, TrackingInfo } from '@/types/order';
import type { ShippingProvider } from './shippingProvider';

// ============================================================================
// CorreoArgentinoService
//
// La API de Correo Argentino / MiCorreo / PAQ.AR NO es pública. Hay que
// pedirla al área comercial (eCommerce / Soluciones Empresariales) y firmar
// un convenio. Suelen entregar:
//   - WSDL/Swagger oficial
//   - Usuario / password / contrato / centro de imposición
//   - Documentación de los endpoints
//
// === DÓNDE PEGAR INFORMACIÓN REAL ===
// 1) Reemplazar los endpoints PLACEHOLDER en los métodos `createShipment`,
//    `getLabel` y `getTracking`.
// 2) Adaptar el payload de `buildCreateRequest` al shape que pida la doc.
// 3) Adaptar `parseCreateResponse` al shape de respuesta real.
// 4) Configurar credenciales en .env (CORREO_AR_*).
//
// Mientras tanto: si MOCK_MODE=true se devuelve una etiqueta auto-generada
// con un tracking simulado, para que el resto del flujo funcione end-to-end.
// ============================================================================

export class CorreoArgentinoService implements ShippingProvider {
  readonly name = 'CORREO_ARGENTINO' as const;

  isConfigured(): boolean {
    const cfg = env();
    return Boolean(
      cfg.CORREO_AR_API_URL &&
        cfg.CORREO_AR_USER &&
        cfg.CORREO_AR_PASSWORD &&
        cfg.CORREO_AR_CONTRATO,
    );
  }

  validateShipmentData(payload: ShipmentPayload): string[] {
    const errors: string[] = [];
    const { order, package: pkg, sender } = payload;

    if (!order.customer.fullName?.trim()) errors.push('Falta nombre del destinatario');
    if (!order.shipTo.street?.trim()) errors.push('Falta calle de destino');
    if (!order.shipTo.city?.trim()) errors.push('Falta ciudad de destino');
    if (!order.shipTo.province?.trim()) errors.push('Falta provincia de destino');
    if (!order.shipTo.postalCode?.trim()) errors.push('Falta código postal de destino');
    if (!order.customer.phone?.trim()) errors.push('Falta teléfono del destinatario');

    if (!sender.postalCode?.trim()) errors.push('Falta CP de origen (configuración)');
    if (!sender.street?.trim()) errors.push('Falta dirección de origen (configuración)');

    if (pkg.weightKg <= 0) errors.push('Peso del paquete inválido');
    if (pkg.lengthCm <= 0 || pkg.widthCm <= 0 || pkg.heightCm <= 0) {
      errors.push('Dimensiones del paquete inválidas');
    }

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

    // ============= TODO: completar con doc oficial Correo Argentino =============
    // Endpoint placeholder. Reemplazar por el real (ej: `/imposicion/v1/envios`).
    // Mantener el logApiCall + sanitización.
    const url = `${env().CORREO_AR_API_URL}/PLACEHOLDER/envios`;
    const requestBody = buildCreateRequest(payload);
    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: tipo de auth real (Basic? Bearer? token rotativo?).
          Authorization: `Basic ${Buffer.from(
            `${env().CORREO_AR_USER}:${env().CORREO_AR_PASSWORD}`,
          ).toString('base64')}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      throw new CarrierError(
        `No se pudo conectar con Correo Argentino: ${(err as Error).message}`,
        this.name,
      );
    }

    const responseBody = await safeReadJson(res);
    await logApiCall({
      provider: 'correo_argentino',
      endpoint: url,
      method: 'POST',
      statusCode: res.status,
      requestBody,
      responseBody,
      durationMs: Date.now() - start,
      success: res.ok,
    });

    if (!res.ok) {
      throw new CarrierError(
        `Correo Argentino devolvió HTTP ${res.status}`,
        this.name,
        responseBody,
      );
    }

    return parseCreateResponse(responseBody, requestBody);
  }

  async getLabel(trackingNumber: string): Promise<{ pdfBytes: Uint8Array; mimeType: string }> {
    if (env().MOCK_MODE || !this.isConfigured()) {
      throw new CarrierError(
        'getLabel solo es válido tras crear el envío. Usá createShipment().',
        this.name,
      );
    }
    // ============= TODO: endpoint real =============
    // Ej: GET /imposicion/v1/envios/{tracking}/rotulo (PDF binario)
    const url = `${env().CORREO_AR_API_URL}/PLACEHOLDER/envios/${trackingNumber}/rotulo`;
    const start = Date.now();
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env().CORREO_AR_USER}:${env().CORREO_AR_PASSWORD}`,
        ).toString('base64')}`,
      },
    });
    await logApiCall({
      provider: 'correo_argentino',
      endpoint: url,
      method: 'GET',
      statusCode: res.status,
      durationMs: Date.now() - start,
      success: res.ok,
    });
    if (!res.ok) throw new CarrierError(`getLabel falló: HTTP ${res.status}`, this.name);
    const buf = new Uint8Array(await res.arrayBuffer());
    return { pdfBytes: buf, mimeType: 'application/pdf' };
  }

  async getTracking(trackingNumber: string): Promise<TrackingInfo> {
    if (env().MOCK_MODE || !this.isConfigured()) {
      return {
        trackingNumber,
        status: 'EN_TRANSITO',
        events: [{ date: new Date().toISOString(), description: 'Mock: pieza en tránsito' }],
        raw: null,
      };
    }
    // ============= TODO: endpoint real =============
    // Posibilidad pública: https://www.correoargentino.com.ar/formularios/ondnc (HTML, no API).
    // Para tracking programático generalmente el contrato da un endpoint REST específico.
    throw new NotConfiguredError('Correo Argentino getTracking');
  }

  // ---------------------------------------------------------------------------
  // Mock: simulamos el carrier para desarrollo / demo / fallback.
  // ---------------------------------------------------------------------------
  private async mockCreateShipment(payload: ShipmentPayload): Promise<ShipmentResult> {
    const trackingNumber = `CA${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const pdf = await generateLabelPdf({
      trackingNumber,
      carrier: 'CORREO_ARGENTINO',
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
      carrier: 'CORREO_ARGENTINO',
      trackingNumber,
      labelPdfBytes: pdf.bytes,
      rawRequest: { mock: true, payload: { orderNumber: payload.order.orderNumber } },
      rawResponse: { mock: true, trackingNumber, labelPath: pdf.filePath },
    };
  }
}

// ============================================================================
// Helpers — adaptar a la doc real cuando esté disponible.
// ============================================================================

function buildCreateRequest(payload: ShipmentPayload): Record<string, unknown> {
  // TODO: este shape es ilustrativo. Reemplazar por el oficial.
  return {
    contrato: env().CORREO_AR_CONTRATO,
    cliente: env().CORREO_AR_CLIENTE_ID,
    servicio: payload.service === 'pickup_point' ? 'SUCURSAL' : 'DOMICILIO',
    remitente: {
      nombre: payload.sender.name,
      calle: payload.sender.street,
      numero: payload.sender.number,
      localidad: payload.sender.city,
      provincia: payload.sender.province,
      codigoPostal: payload.sender.postalCode,
      telefono: payload.sender.phone,
      email: payload.sender.email,
    },
    destinatario: {
      nombre: payload.order.customer.fullName,
      documento: payload.order.customer.document,
      calle: payload.order.shipTo.street,
      numero: payload.order.shipTo.number,
      piso: payload.order.shipTo.floor,
      localidad: payload.order.shipTo.city,
      provincia: payload.order.shipTo.province,
      codigoPostal: payload.order.shipTo.postalCode,
      telefono: payload.order.customer.phone,
      email: payload.order.customer.email,
    },
    paquete: {
      pesoGramos: Math.round(payload.package.weightKg * 1000),
      largoCm: payload.package.lengthCm,
      anchoCm: payload.package.widthCm,
      altoCm: payload.package.heightCm,
    },
    referenciaExterna: payload.order.orderNumber,
  };
}

function parseCreateResponse(
  responseBody: unknown,
  requestBody: unknown,
): ShipmentResult {
  // TODO: ajustar al shape oficial.
  const r = responseBody as {
    trackingNumber?: string;
    numeroEnvio?: string;
    rotuloUrl?: string;
    labelUrl?: string;
  };
  const trackingNumber = r?.trackingNumber ?? r?.numeroEnvio;
  if (!trackingNumber) {
    throw new CarrierError(
      'Respuesta de Correo Argentino no incluye tracking number',
      'CORREO_ARGENTINO',
      responseBody,
    );
  }
  return {
    carrier: 'CORREO_ARGENTINO',
    trackingNumber,
    labelUrl: r?.rotuloUrl ?? r?.labelUrl,
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
