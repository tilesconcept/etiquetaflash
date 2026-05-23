# Arquitectura — EtiquetaFlash

## Resumen

App Next.js que recibe PDFs de etiquetas de Tienda Nube, los parsea, persiste
los pedidos en Postgres y genera dos archivos descargables (CSV para Correo
Argentino, XLSX para Sinergia) listos para subir a los formularios de carga
masiva de cada plataforma.

**No hay integraciones HTTP con carriers.** El usuario sube los Excel manualmente.

```
        PDFs Tienda Nube
              │
              ▼
┌─────────────────────────────┐
│  POST /api/uploads          │
│  ┌─────────────────────┐    │
│  │  pdfParser.ts       │    │  unpdf + pdfjs (posiciones)
│  │  (texto + layout)   │    │  → reconstruye líneas
│  └──────────┬──────────┘    │
│             ▼               │
│  upsert Order (Prisma)      │
└─────────────────────────────┘
              │
              ▼
       Dashboard editable
              │
              ▼
┌─────────────────────────────┐
│  POST /api/exports/*        │
│  ┌─────────────────────┐    │
│  │  Correo Argentino   │    │  exporters/correoArgentinoExporter
│  │  → CSV  ;  UTF-8 BOM│    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │  Sinergia           │    │  exporters/sinergiaExporter  (ExcelJS)
│  │  → XLSX             │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
              │
              ▼
     Descarga al navegador
              +
     persist en storage/exports/
     +
     registro en `Export` (auditoría)
```

## Decisiones

### 1. Parser de PDF con posiciones (no texto plano)

`unpdf.extractText` aplana el contenido a una sola línea, pierde estructura.
Usamos `getDocumentProxy(...).getPage(i).getTextContent()` (API de pdfjs) que
devuelve items con `transform[4]` (X) y `transform[5]` (Y). Agrupamos por Y con
tolerancia de 3px → reconstruimos líneas → ordenamos por X. El resultado se ve
idéntico al `pdftotext -layout` de poppler, pero corre 100% en Node sin
binarios nativos (sirve para Vercel).

### 2. Una Order = una línea del Excel

Cada Order se mapea 1:1 con una fila del bulk. Los campos específicos de cada
carrier (sucursal Correo, FLEX ID Sinergia) viven en el mismo modelo;
los exporters eligen qué columnas usar.

### 3. Validación previa al export (dryRun)

Cada export recibe `dryRun: true` opcional. En vez de generar el archivo,
devuelve la lista de issues por orden (`#397: falta email`). La UI usa esto
para mostrar al usuario qué tiene que corregir antes de descargar.

### 4. Inferencia automática

- **Código de provincia Correo Argentino** (1 letra): se infiere primero del CPA
  (`C1414AAA` → `C`), luego del nombre normalizado de la provincia. Si no se
  puede, queda vacío y se marca como issue.
- **Carrier**: detectado desde la línea `Correo Argentino …` / `Sinergia …`
  del PDF. Editable por fila.
- **Modo de envío**: `Dirección de retiro:` → PICKUP_BRANCH, `Dirección de envío:` → HOME.
- **Celular**: el formato `+5491145678901` se separa en
  `cod_area_cel` (`11`) + `cel` (`45678901`) — Correo lo pide separado.

### 5. PICKUP_BRANCH solo aplica para Correo Argentino

Sinergia no maneja retiro en sucursal (sólo domicilio). El validador de
Sinergia rechaza órdenes marcadas como pickup; el usuario debe convertirlas
a HOME (cargando una dirección) o exportarlas únicamente por Correo.

### 6. Persistencia de exports

Cada export queda guardado:
- En `storage/exports/` (filesystem)
- Como fila en `Export` con `rowCount`, `sizeBytes`, `userId`, etc.
- Con `ExportItem` linkeando a cada Order incluida.

Esto permite:
- Re-descargar el mismo archivo (`/api/exports/{id}/download`).
- Marcar Orders como `exported=true` (filtran del dashboard por default).
- Auditoría: quién generó qué y cuándo.

## Modelo de datos

```
User (1) ─── (N) Export
                  │
                  └─── (N) ExportItem ─── (N) Order

Settings (singleton id="default")

Order
 ├── identidad: orderNumber + packageNumber (unique)
 ├── source: PDF_UPLOAD | MANUAL | TIENDANUBE_API
 ├── carrier: CORREO_ARGENTINO | SINERGIA | OTRO
 ├── shippingMode: HOME | PICKUP_BRANCH
 ├── destinatario / dirección / sucursal (todo editable)
 ├── paquete (override sobre defaults de Settings)
 ├── flexId / shipmentDetail (Sinergia)
 ├── productsJson / productsSummary
 ├── exported / lastExportId
 └── pdfRawText (auditoría)
```

## Próximos pasos sugeridos

- Cargar las 4187 sucursales Correo Argentino y autocompletar `pickupBranchCode`
  a partir del nombre detectado en el PDF.
- Webhook de Tienda Nube para recibir nuevos pedidos automáticamente
  (alternativa al upload manual).
- Soporte multi-tenant (varias tiendas).
- Mover storage de exports a S3/R2 para serverless.
