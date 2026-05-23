import { prisma } from './prisma';

const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'access_token',
  'accessToken',
  'refresh_token',
  'authorization',
  'api_key',
  'apiKey',
  'client_secret',
  'clientSecret',
];

// Devuelve una copia sin claves sensibles y trunca strings largos.
export function sanitize(value: unknown, maxStringLength = 2000): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > maxStringLength ? value.slice(0, maxStringLength) + '…[truncado]' : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, maxStringLength));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitize(v, maxStringLength);
      }
    }
    return out;
  }
  return value;
}

export interface ApiLogInput {
  userId?: string | null;
  provider: 'tiendanube' | 'correo_argentino' | 'sinergia' | 'mock';
  endpoint: string;
  method: string;
  statusCode?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

export async function logApiCall(input: ApiLogInput): Promise<void> {
  try {
    await prisma.apiLog.create({
      data: {
        userId: input.userId ?? null,
        provider: input.provider,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        requestBody:
          input.requestBody !== undefined
            ? JSON.stringify(sanitize(input.requestBody))
            : null,
        responseBody:
          input.responseBody !== undefined
            ? JSON.stringify(sanitize(input.responseBody))
            : null,
        durationMs: input.durationMs,
        success: input.success ?? (input.statusCode ? input.statusCode < 400 : false),
        errorMessage: input.errorMessage,
      },
    });
  } catch (err) {
    // Logging nunca debe romper el flujo principal.
    console.error('No se pudo persistir ApiLog:', err);
  }
}
