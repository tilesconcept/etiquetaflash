export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 422, details);
    this.name = 'ValidationError';
  }
}

export class CarrierError extends AppError {
  constructor(message: string, public readonly carrier: string, details?: unknown) {
    super(message, 'CARRIER_ERROR', 502, details);
    this.name = 'CarrierError';
  }
}

export class NotConfiguredError extends AppError {
  constructor(integration: string) {
    super(
      `Integración "${integration}" no configurada. Completar credenciales en .env`,
      'NOT_CONFIGURED',
      501,
    );
    this.name = 'NotConfiguredError';
  }
}

export function toJsonError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: { error: err.message, code: err.code, details: err.details },
    };
  }
  const message = err instanceof Error ? err.message : 'Error desconocido';
  return {
    status: 500,
    body: { error: message, code: 'INTERNAL_ERROR' },
  };
}
