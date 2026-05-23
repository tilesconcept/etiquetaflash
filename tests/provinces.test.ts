import { describe, it, expect } from 'vitest';
import { resolveProvinceCode, provinceCodeFromCpa } from '@/lib/argentinaProvinces';

describe('argentinaProvinces', () => {
  it('resuelve códigos desde el nombre normalizado', () => {
    expect(resolveProvinceCode('Buenos Aires')).toBe('B');
    expect(resolveProvinceCode('CABA')).toBe('C');
    expect(resolveProvinceCode('CIUDAD AUTONOMA BUENOS AIRES')).toBe('C');
    expect(resolveProvinceCode('Ciudad Autónoma de Buenos Aires')).toBe('C');
    expect(resolveProvinceCode('Córdoba')).toBe('X');
    expect(resolveProvinceCode('Tierra del Fuego')).toBe('V');
    expect(resolveProvinceCode('Río Negro')).toBe('R');
  });

  it('devuelve undefined si no conoce la provincia', () => {
    expect(resolveProvinceCode('Atlántida')).toBeUndefined();
    expect(resolveProvinceCode('')).toBeUndefined();
    expect(resolveProvinceCode(null)).toBeUndefined();
  });

  it('extrae código de provincia desde el CPA', () => {
    expect(provinceCodeFromCpa('C1414AAA')).toBe('C');
    expect(provinceCodeFromCpa('V9410BFD')).toBe('V');
    expect(provinceCodeFromCpa('1043')).toBeUndefined();
    expect(provinceCodeFromCpa(null)).toBeUndefined();
  });
});
