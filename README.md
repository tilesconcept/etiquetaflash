# EtiquetaFlash · Tiles Concept

Aplicación web interna que automatiza la generación de etiquetas de envío
para los pedidos pagados en Tienda Nube. Soporta Correo Argentino y Sinergia
como operadores logísticos a través de una interfaz común (`ShippingProvider`).

> **Estado**: MVP funcional. Tienda Nube usa endpoints oficiales documentados.
> Correo Argentino y Sinergia usan **placeholders** — buscá los bloques marcados
> con `TODO` para enchufar los endpoints reales cuando tengas la documentación
> y las credenciales.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **Prisma** + **PostgreSQL**
- **NextAuth** (Credentials provider)
- **Zod** (validación)
- **pdf-lib** (generación de PDFs de etiqueta)
- **Vitest** (tests)

## Estructura

```
src/
├── app/                    Next.js App Router (UI + API routes)
│   ├── api/
│   │   ├── auth/[...nextauth]/   NextAuth
│   │   ├── tiendanube/orders     Listar / sincronizar pedidos
│   │   ├── tiendanube/callback   OAuth callback
│   │   ├── shipments             Crear etiqueta individual
│   │   ├── shipments/batch       Crear etiquetas en lote
│   │   ├── shipments/[id]/label  Descargar PDF
│   │   └── settings              GET/PUT de configuración
│   ├── dashboard/                Listado de pedidos
│   ├── shipments/                Historial de etiquetas
│   ├── settings/                 Configuración (paquete + remitente)
│   └── login/
├── components/             Componentes React (tabla, formularios, nav)
├── lib/                    prisma · auth · encryption · logger · pdf · env
├── services/
│   ├── tiendaNubeService.ts          Cliente Nuvemshop (oficial)
│   ├── correoArgentinoService.ts     Placeholder + interfaz lista
│   ├── sinergiaService.ts            Placeholder + interfaz lista
│   ├── shippingProvider.ts           Interfaz común
│   ├── shipmentOrchestrator.ts       Crea envío + PDF + persiste
│   └── orderSync.ts
├── validators/             Validación de pedidos
├── mocks/                  Datos mock para MOCK_MODE
└── types/
prisma/
├── schema.prisma           users · stores · orders · shipments · labels · logs
└── seed.ts
tests/                      Vitest
```

## Instalación

### 1. Pre-requisitos

- Node.js ≥ 18.18
- PostgreSQL 13+ corriendo en local (o conexión remota)
- npm

### 2. Clonar e instalar

```bash
git clone <repo>
cd etiquetaflash
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```bash
# Genera el secreto y la clave de cifrado:
openssl rand -base64 32   # → NEXTAUTH_SECRET
openssl rand -hex 32      # → ENCRYPTION_KEY

# Para arrancar sin APIs reales:
MOCK_MODE=true

# Base de datos:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/etiquetaflash?schema=public
```

### 4. Base de datos

```bash
npm run prisma:migrate     # crea las tablas
npm run db:seed            # crea admin + tienda mock + settings default
```

Usuario por defecto del seed: `admin@tilesconcept.com` / `cambiame123`
(podés cambiarlos en `.env` antes de seedear).

### 5. Correr

```bash
npm run dev
# http://localhost:3000
```

### 6. Tests

```bash
npm test
```

---

## Modo Mock vs Modo Producción

`MOCK_MODE=true` (default en `.env.example`):
- Tienda Nube devuelve 3 pedidos hardcodeados (`src/mocks/orders.ts`).
- Correo Argentino y Sinergia simulan la creación de envío y generan un PDF
  propio con `pdf-lib`. No se hace ninguna llamada de red.
- Útil para demos, desarrollo y QA.

`MOCK_MODE=false`:
- Se conecta a Tienda Nube real (necesita OAuth completo).
- Llama a los endpoints de Correo Argentino / Sinergia que estén cargados en `.env`.
  Como esos endpoints son placeholders, **fallarán** hasta que se actualicen
  con los reales (ver sección siguiente).

---

## Dónde pegar datos reales

### Tienda Nube — credenciales OAuth

1. Crear app en https://partners.tiendanube.com/.
2. Configurar redirect URI: `{NEXTAUTH_URL}/api/tiendanube/callback`.
3. Copiar `App ID` y `Client Secret` a `.env`:
   ```
   TIENDANUBE_APP_ID=...
   TIENDANUBE_CLIENT_SECRET=...
   TIENDANUBE_USER_AGENT=EtiquetaFlash (admin@tilesconceptar.com)
   ```
4. Visitar el authorize URL desde la documentación oficial; Nuvemshop redirige
   a `/api/tiendanube/callback` con `?code=...` y se guarda el token cifrado
   en `stores.accessTokenEnc`.

Docs: https://dev.tiendanube.com/docs/api

### Correo Argentino — endpoints reales

La API NO es pública. Hay que pedirla al área eCommerce / Soluciones
Empresariales y firmar convenio. Una vez que tengas la documentación:

1. Cargá credenciales en `.env`:
   ```
   CORREO_AR_API_URL=...
   CORREO_AR_USER=...
   CORREO_AR_PASSWORD=...
   CORREO_AR_CONTRATO=...
   CORREO_AR_CLIENTE_ID=...
   ```
2. Editá `src/services/correoArgentinoService.ts`. Buscá los comentarios
   marcados con **`TODO`**:
   - `createShipment()` → reemplazar URL `/PLACEHOLDER/envios` por la real.
   - `getLabel()` → reemplazar URL `/PLACEHOLDER/envios/{tracking}/rotulo`.
   - `getTracking()` → implementar.
   - `buildCreateRequest()` → ajustar el shape del payload.
   - `parseCreateResponse()` → ajustar el shape de respuesta.
3. Tipo de auth: el placeholder usa Basic Auth. Cambiarlo si la doc pide
   Bearer / token rotativo / firma HMAC / SOAP.

### Sinergia — endpoints reales

No hay documentación pública identificada. Pasos cuando la consigas:

1. Cargá credenciales en `.env`:
   ```
   SINERGIA_API_URL=...
   SINERGIA_API_KEY=...
   SINERGIA_CLIENT_ID=...
   ```
2. Editá `src/services/sinergiaService.ts`. Mismo proceso que Correo:
   buscá `TODO` y reemplazá los placeholders.

---

## Flujo de uso

1. Login con `admin@tilesconcept.com`.
2. **Configuración** → completar dirección de origen, peso/medidas default,
   carrier preferido. Esto es obligatorio antes de generar etiquetas.
3. **Pedidos** → botón "Sincronizar Tienda Nube" trae pedidos pagados sin
   despachar. En MOCK_MODE devuelve los 3 hardcodeados.
4. Para cada pedido el sistema valida (nombre, teléfono, calle, ciudad,
   provincia, CP, peso). Si falta algo, el botón "Generar" devuelve el error
   con el campo concreto y no se llama al carrier.
5. Generar etiqueta individual o seleccionar varios y "Generar en lote".
6. **Etiquetas** → historial con descarga de PDFs y estados.

## Seguridad

- `accessToken` de Tienda Nube cifrado con AES-256-GCM antes de persistir
  (`src/lib/encryption.ts`).
- Logs de API en DB con keys sensibles redactadas (`src/lib/logger.ts`).
- Credenciales de carriers solo en variables de entorno, nunca en frontend.
- Auth en todos los endpoints API (`getServerSession`).
- Passwords con bcrypt cost 10.

## Endpoints internos (resumen)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | Login / logout |
| `GET` | `/api/tiendanube/callback` | OAuth callback |
| `GET` | `/api/tiendanube/orders?refresh=true` | Listar/sincronizar pedidos |
| `POST` | `/api/shipments` | Generar etiqueta para un pedido |
| `POST` | `/api/shipments/batch` | Generar etiquetas en lote |
| `GET` | `/api/shipments/:id/label` | Descargar PDF de etiqueta |
| `GET` | `/api/settings` | Leer configuración |
| `PUT` | `/api/settings` | Actualizar configuración |
| `GET` | `/api/health` | Healthcheck |

## Deploy

- **Vercel** (recomendado): conectar repo, configurar variables de entorno,
  apuntar `DATABASE_URL` a un Postgres administrado (Neon, Supabase, Railway).
- **Railway / Render**: build command `npm run build`, start `npm run start`.

> Importante: el directorio `storage/labels/` se usa para PDFs descargados.
> En Vercel su filesystem es efímero — para producción real conviene volcar
> esos PDFs a S3 / R2 / un Blob storage. El campo `Shipment.labelUrl` ya
> contempla URLs externas.

## Limitaciones conocidas / TODOs

- Tienda Nube: el OAuth flow está implementado pero no hay UI de "conectar".
  Por ahora se asume que el `code` se redirige al callback manualmente (o se
  trabaja en MOCK_MODE).
- Correo Argentino y Sinergia: todos los endpoints son placeholders.
- Tracking en TN: el shape del PUT `/orders/{id}` se basa en documentación
  general; verificar la versión vigente.
- Almacenamiento de PDFs: actualmente local. Migrar a object storage para prod.
- Falta UI para reintentar shipments en estado `ERROR`.

## Licencia

Uso interno · Tiles Concept.
