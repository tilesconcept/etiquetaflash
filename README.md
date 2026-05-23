# EtiquetaFlash · Tiles Concept

App web interna que convierte PDFs de etiquetas de Tienda Nube en los
**archivos de carga masiva** que piden Correo Argentino (CSV) y Sinergia (XLSX).
**No se conecta a las APIs** de ningún operador: vos generás los Excel acá y los
subís manualmente al panel bulk de cada plataforma.

## Flujo

1. Descargás las etiquetas de Tienda Nube como PDF (como hasta ahora).
2. Las arrastrás al dashboard de EtiquetaFlash (podés subir muchas a la vez).
3. El sistema parsea cada PDF, detecta operador (Correo Argentino o Sinergia),
   destinatario, dirección, sucursal de retiro, DNI, teléfono y productos.
4. En la tabla revisás/editás campos faltantes (email obligatorio para Correo,
   código de sucursal, etc.).
5. Click en **Exportar Correo Argentino (N)** → descarga
   `correo-argentino-carga-masiva-YYYYMMDD-HHmm.csv`.
6. Click en **Exportar Sinergia (N)** → descarga
   `sinergia-carga-masiva-YYYYMMDD-HHmm.xlsx`.
7. Subís cada archivo al panel bulk-add de la plataforma correspondiente.

## Stack

- **Next.js 14** App Router + TypeScript + Tailwind
- **Prisma** + PostgreSQL
- **NextAuth** (Credentials)
- **unpdf** (extracción de texto desde PDF con posiciones)
- **exceljs** (XLSX de Sinergia)
- **Zod** + **Vitest**

## Estructura

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   NextAuth
│   │   ├── uploads/              POST PDFs → parsea → upsert Orders
│   │   ├── orders/               GET / DELETE listado
│   │   ├── orders/[id]/          PATCH datos editables / DELETE
│   │   ├── exports/              GET historial
│   │   ├── exports/correo-argentino  POST → CSV bulk Correo Argentino
│   │   ├── exports/sinergia          POST → XLSX bulk Sinergia
│   │   ├── exports/[id]/download     Reenviar un export ya generado
│   │   ├── settings              GET/PUT
│   │   └── health
│   ├── dashboard/                Subida + tabla editable + botones de export
│   ├── exports/                  Historial de archivos generados
│   ├── settings/                 Defaults de paquete + remitente + FLEX
│   └── login/
├── components/                   PdfUploader, OrdersTable, SettingsForm, Nav
├── lib/                          prisma · auth · env · errors · argentinaProvinces
├── services/
│   ├── pdfParser.ts              Parser de etiquetas Tienda Nube (pdfjs + posiciones)
│   ├── settingsService.ts
│   └── exporters/
│       ├── types.ts
│       ├── correoArgentinoExporter.ts   CSV ; · 21 columnas oficiales
│       └── sinergiaExporter.ts          XLSX · 10 columnas del form bulk
└── types/
prisma/
├── schema.prisma                 User, Settings, Order, Export, ExportItem
└── seed.ts
tests/
├── fixtures/tn-label-pickup.pdf
├── pdfParser.test.ts
├── exporters.test.ts
└── provinces.test.ts
```

## Instalación

### Requisitos

- Node.js ≥ 18.18
- PostgreSQL 13+

### Pasos

```bash
git clone <repo>
cd etiquetaflash
npm install
cp .env.example .env
# editar .env: NEXTAUTH_SECRET (openssl rand -base64 32) y DATABASE_URL
npm run prisma:migrate
npm run db:seed
npm run dev
# http://localhost:3000
```

Credenciales por defecto del seed: `admin@tilesconceptar.com` / `cambiame123`
(modificables vía `ADMIN_EMAIL` / `ADMIN_PASSWORD` en `.env`).

### Tests

```bash
npm test
```

## Formato de los archivos de carga masiva

### Correo Argentino (`.csv`, separador `;`, UTF-8 con BOM)

Headers exactos según `Plantilla_Carga_Masiva.csv`:

```
tipo_producto(obligatorio);largo(obligatorio en CM);ancho(obligatorio en CM);
altura(obligatorio en CM);peso(obligatorio en KG);
valor_del_contenido(obligatorio en pesos argentinos);
provincia_destino(obligatorio);
sucursal_destino(obligatorio solo en caso de no ingresar localidad de destino);
localidad_destino(...);calle_destino(...);altura_destino(...);
piso(opcional...);dpto(opcional...);codpostal_destino(...);
destino_nombre(obligatorio);destino_email(obligatorio, debe ser un email valido);
cod_area_tel(opcional);tel(opcional);
cod_area_cel(obligatorio);cel(obligatorio);
numero_orden(opcional)
```

- `tipo_producto`: `CP` (Clásico), `EP` (Expreso) o `UP` (Hoy).
- `provincia_destino`: 1 letra (A=Salta, B=Buenos Aires, C=CABA, V=Tierra del Fuego, …).
  Se infiere automáticamente del CPA (`C1414AAA` → `C`) o del nombre de la provincia.
- Si es **retiro en sucursal**: completar `sucursal_destino` con el código de 3 letras
  (ver `codigos_sucursales_y_provincias_MiCorreo.xlsx`) y dejar vacíos
  localidad/calle/altura/CP.
- Si es **envío a domicilio**: dejar sucursal vacía y completar localidad/calle/altura/CP.
- El celular se separa automáticamente en código de área + número
  (ej. `+5491145678901` → `11` + `45678901`).

### Sinergia (`.xlsx`)

Columnas según `https://sinergiasoftware.xyz/clients/bulk-add/` (obligatorias resaltadas en azul):

```
ID FLEX · DOMICILIO · ENTRECALLES · CODIGO POSTAL · LOCALIDAD ·
PARTIDO · DESTINATARIO · DNI DESTINATARIO · TELEFONO DESTINATARIO ·
DETALLE DEL ENVIO
```

- **Obligatorios**: `ID FLEX`, `DOMICILIO`, `LOCALIDAD`.
- `ID FLEX`: si tus envíos son FLEX podés poner `flex` (configurable en /settings).
- `DOMICILIO`: se compone como `Calle Número Piso X Dto Y`.
- `DETALLE DEL ENVIO`: vacío para paquetes < 5 kg (recomendación del form Sinergia);
  se completa con el resumen de productos si el peso es ≥ 5 kg.
- Sinergia **no soporta retiro en sucursal**: si subís una etiqueta de TN que es
  pickup en sucursal de Correo, el sistema te avisa (la podés cambiar a HOME +
  domicilio manualmente o exportarla solo por Correo Argentino).

## Configuración (`/settings`)

- Paquete por defecto: tipo_producto, largo/ancho/alto, peso, valor del contenido.
  Se aplica a todos los pedidos a menos que sobreescribas por fila en la tabla.
- ID FLEX por defecto (Sinergia).
- Remitente (informativo; las plataformas usan el remitente del contrato).

## Endpoints internos

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | Login / logout |
| `POST` | `/api/uploads` | Subir N PDFs (multipart) → parsea → upsert Orders |
| `GET` | `/api/orders?carrier=…&exported=false` | Listado filtrable |
| `PATCH` | `/api/orders/{id}` | Editar cualquier campo (carrier, dirección, …) |
| `DELETE` | `/api/orders/{id}` | Eliminar |
| `POST` | `/api/exports/correo-argentino` | `{orderIds, dryRun?}` → CSV |
| `POST` | `/api/exports/sinergia` | `{orderIds, dryRun?}` → XLSX |
| `GET` | `/api/exports` | Historial |
| `GET` | `/api/exports/{id}/download` | Re-descargar un export |
| `GET`/`PUT` | `/api/settings` | Defaults |
| `GET` | `/api/health` | Healthcheck |

`dryRun: true` valida los datos y devuelve la lista de issues sin generar el archivo
(útil para mostrar al usuario qué le falta antes de exportar).

## Seguridad

- Auth en todos los endpoints (NextAuth Credentials + bcrypt cost 10).
- No hay credenciales de terceros que guardar (no nos conectamos a APIs externas).
- Datos sensibles del PDF (DNI, teléfono) solo en DB local, no se envían a ningún lado.

## Deploy

- **Vercel** / **Railway** / **Render**.
- DB: Neon / Supabase / Railway Postgres.
- Filesystem: en Vercel es efímero — los exports se persisten en `storage/exports/`.
  Para producción seria, migrar a S3/R2 (cambiar `persistFile` en
  `src/app/api/exports/*/route.ts`). Igualmente, los archivos siempre se devuelven
  inline en la response del POST; el storage es solo para re-descarga.

## Limitaciones / TODO

- El parser asume el formato actual de las etiquetas de Tienda Nube
  (header `Orden #X - Paquete #Y`, líneas `Dirección de retiro:` / `Entregar a:`).
  Si TN cambia el layout hay que ajustar `src/services/pdfParser.ts`.
- Resolución de **código de sucursal** Correo Argentino: hoy es manual
  (el usuario lo carga en la tabla). Próximo paso: cargar el dataset de 4187
  sucursales (`codigos_sucursales_y_provincias_MiCorreo.xlsx`) y mostrar un
  autocompletado por nombre.
- `cod_area_tel` / `tel` no se completan (CA los marca opcionales).
- Para etiquetas TN sin “Entregar a:” explícito (raro) el parser lo deja vacío
  y se edita a mano.

## Licencia

Uso interno · Tiles Concept.
