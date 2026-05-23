import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET muy corto'),
  DATABASE_URL: z.string().min(1),
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
