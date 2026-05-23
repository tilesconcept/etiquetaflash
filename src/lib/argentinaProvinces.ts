// Códigos de provincia usados por Correo Argentino (PAQ.AR).
// Fuente: archivo "codigos_sucursales_y_provincias_MiCorreo.xlsx", solapa
// "Envío a domicilio". 24 jurisdicciones (CABA + 23 provincias).
export const PROVINCE_CODE_BY_NAME: Record<string, string> = {
  SALTA: 'A',
  'BUENOS AIRES': 'B',
  'CAPITAL FEDERAL': 'C',
  'CIUDAD AUTONOMA BUENOS AIRES': 'C',
  'CIUDAD AUTÓNOMA DE BUENOS AIRES': 'C',
  CABA: 'C',
  'SAN LUIS': 'D',
  'ENTRE RIOS': 'E',
  'ENTRE RÍOS': 'E',
  'LA RIOJA': 'F',
  'SANTIAGO DEL ESTERO': 'G',
  CHACO: 'H',
  'SAN JUAN': 'J',
  CATAMARCA: 'K',
  'LA PAMPA': 'L',
  MENDOZA: 'M',
  MISIONES: 'N',
  FORMOSA: 'P',
  NEUQUEN: 'Q',
  NEUQUÉN: 'Q',
  'RIO NEGRO': 'R',
  'RÍO NEGRO': 'R',
  'SANTA FE': 'S',
  TUCUMAN: 'T',
  TUCUMÁN: 'T',
  CHUBUT: 'U',
  'TIERRA DEL FUEGO': 'V',
  CORRIENTES: 'W',
  CORDOBA: 'X',
  CÓRDOBA: 'X',
  JUJUY: 'Y',
  'SANTA CRUZ': 'Z',
};

export function resolveProvinceCode(name?: string | null): string | undefined {
  if (!name) return undefined;
  const key = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();
  return PROVINCE_CODE_BY_NAME[key] ?? PROVINCE_CODE_BY_NAME[name.toUpperCase().trim()];
}

// CPA argentino (ej. C1414AAA) → la primera letra es el código de provincia.
export function provinceCodeFromCpa(cpa?: string | null): string | undefined {
  if (!cpa) return undefined;
  const m = cpa.trim().match(/^([A-Z])\d{4}[A-Z]{3}$/i);
  return m ? m[1].toUpperCase() : undefined;
}
