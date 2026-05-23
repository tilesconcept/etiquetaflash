import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET muy corto'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY debe ser 32 bytes en hex (64 chars)'),
  MOCK_MODE: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
  DATABASE_URL: z.string().min(1),

  TIENDANUBE_APP_ID: z.string().optional(),
  TIENDANUBE_CLIENT_SECRET: z.string().optional(),
  TIENDANUBE_USER_AGENT: z.string().optional(),

  CORREO_AR_API_URL: z.string().url().optional(),
  CORREO_AR_USER: z.string().optional(),
  CORREO_AR_PASSWORD: z.string().optional(),
  CORREO_AR_CONTRATO: z.string().optional(),
  CORREO_AR_CLIENTE_ID: z.string().optional(),

  SINERGIA_API_URL: z.string().url().optional(),
  SINERGIA_API_KEY: z.string().optional(),
  SINERGIA_CLIENT_ID: z.string().optional(),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
    throw new Error('Configuración inválida. Revisar .env contra .env.example');
  }
  cached = parsed.data;
  return cached;
}
