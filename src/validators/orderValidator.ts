import type { NormalizedOrder } from '@/types/order';

export interface ValidationIssue {
  field: string;
  message: string;
}

// Reglas mínimas para que un pedido pueda generar etiqueta.
// Se aplican antes de llamar al carrier. Cada carrier puede agregar reglas
// adicionales (ver `validateShipmentData` de cada service).
export function validateOrderForShipment(order: NormalizedOrder): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!order.customer.fullName?.trim()) {
    issues.push({ field: 'customer.fullName', message: 'Falta nombre del destinatario' });
  }

  if (!order.customer.phone?.trim()) {
    issues.push({ field: 'customer.phone', message: 'Falta teléfono del destinatario' });
  } else if (!isValidArPhone(order.customer.phone)) {
    issues.push({ field: 'customer.phone', message: 'Teléfono con formato inválido' });
  }

  if (!order.shipTo.street?.trim()) {
    issues.push({ field: 'shipTo.street', message: 'Falta dirección (calle)' });
  }
  if (!order.shipTo.city?.trim()) {
    issues.push({ field: 'shipTo.city', message: 'Falta ciudad' });
  }
  if (!order.shipTo.province?.trim()) {
    issues.push({ field: 'shipTo.province', message: 'Falta provincia' });
  }
  if (!order.shipTo.postalCode?.trim()) {
    issues.push({ field: 'shipTo.postalCode', message: 'Falta código postal' });
  } else if (!isValidArPostalCode(order.shipTo.postalCode)) {
    issues.push({ field: 'shipTo.postalCode', message: 'Código postal inválido (formato AR)' });
  }

  return issues;
}

// Validaciones básicas Argentina. Tolerantes: aceptan paréntesis, guiones, espacios.
export function isValidArPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '');
  // Móvil/fijo: 8 a 15 dígitos. AR estándar: 10 (sin 0) o 11+ con prefijo.
  return digits.length >= 8 && digits.length <= 15;
}

export function isValidArPostalCode(cp: string): boolean {
  const trimmed = cp.trim();
  // CP clásico: 4 dígitos. CPA: 1 letra + 4 dígitos + 3 letras (ej C1414AAA).
  return /^\d{4}$/.test(trimmed) || /^[A-Za-z]\d{4}[A-Za-z]{3}$/.test(trimmed);
}
