# Arquitectura — EtiquetaFlash

## Vista general

```
Usuario interno
     │
     ▼
[Next.js (UI + API Routes)]
     │
     ├──▶ TiendaNubeService ────▶ api.tiendanube.com (REST, Bearer)
     │
     ├──▶ ShippingProvider (interfaz)
     │      ├── CorreoArgentinoService ────▶ Correo Argentino API (TODO)
     │      └── SinergiaService ───────────▶ Sinergia API (TODO)
     │
     └──▶ Prisma ─────▶ PostgreSQL
                            ├── User
                            ├── Store + StoreSettings
                            ├── Order (cache + raw JSON)
                            ├── Shipment (raw req/res)
                            ├── ShippingLabel (PDFs)
                            └── ApiLog (auditoría sanitizada)
```

## Decisiones clave

### 1. Interfaz `ShippingProvider`
Una sola interfaz (`createShipment`, `getLabel`, `getTracking`,
`validateShipmentData`, `isConfigured`). El orquestador
(`shipmentOrchestrator.ts`) y la UI no conocen carriers concretos. Sumar uno
nuevo es escribir una clase que la implemente.

### 2. Mock mode top-level
`MOCK_MODE=true` cortocircuita TiendaNubeService (datos hardcodeados) y
CorreoArgentino/Sinergia (no llaman a red, generan PDF propio). Eso permite
desarrollar end-to-end sin credenciales y mantiene exactamente el mismo
camino de código que en producción (la diferencia es un `if` al inicio).

### 3. Cache de orders en DB
Sincronizamos pedidos desde TN a `Order` en DB. Razones:
- Permite filtrar/listar sin pegar contra TN cada vez.
- Permite marcar `labelGenerated=true` y filtrar pendientes localmente.
- Guarda el JSON crudo en `Order.raw` para auditoría / debugging.

### 4. Etiquetas (PDF)
Tres caminos:
1. Si el carrier devuelve `labelPdfBytes` → guardamos eso.
2. Si devuelve `labelUrl` → descargamos.
3. Si no devuelve nada → generamos PDF propio con `pdf-lib` (10x15cm).

Se persisten en `storage/labels/` + se registran en `ShippingLabel`.
**Producción**: migrar a S3/R2/Blob (`Shipment.labelUrl` ya lo soporta).

### 5. Cifrado de tokens
`Store.accessTokenEnc` se guarda con AES-256-GCM (`src/lib/encryption.ts`).
La clave está en `ENCRYPTION_KEY` (32 bytes hex). Si rota la clave, hay que
hacer migración de tokens.

### 6. Logging
`ApiLog` guarda toda llamada externa con request/response sanitizados
(claves sensibles → `[REDACTED]`, strings largos truncados). Permite
debugging y auditoría sin filtrar secretos.

### 7. Validación en dos capas
- **Genérica** (`validators/orderValidator.ts`): aplica a cualquier carrier.
- **Específica** del carrier (`validateShipmentData`): cada provider agrega
  sus reglas (ej. CUIT obligatorio si Sinergia lo pide).

El orquestador corre primero la genérica; cada service corre la suya antes
de cualquier fetch a la API externa.

## Flujo de "Generar etiqueta"

```
POST /api/shipments { orderInternalId, carrier }
  │
  ▼
shipmentOrchestrator.generateLabel()
  │
  ├──▶ valida order (validateOrderForShipment)
  ├──▶ arma payload (order + settings.origin + package)
  ├──▶ persiste Shipment(status=PENDING)
  ├──▶ resolveProvider(carrier).createShipment(payload)
  │       └──▶ carrier API (o mock)
  ├──▶ obtiene PDF (bytes | url | self-generated)
  ├──▶ persiste PDF en storage/labels/
  ├──▶ Shipment.update(status=LABEL_READY, tracking, labelPdfPath)
  ├──▶ ShippingLabel.create
  ├──▶ Order.update(labelGenerated=true)
  └──▶ (opcional) TiendaNube.updateOrderTracking(...)
```

Errores en cualquier paso → `Shipment.status=ERROR` + `errorMessage`
visible en `/shipments`.

## Capa de datos

```
User (1) ─── (N) ApiLog
Store (1) ─── (1) StoreSettings
       (1) ─── (N) Order ── (N) Shipment ── (N) ShippingLabel
```

## Decisiones diferidas / candidatos a refactor

- Job queue para `generateBatch` (hoy es `Promise.allSettled` inline). Con
  volumen alto migrar a BullMQ / queue.
- Webhook de Tienda Nube (`order/paid`) para auto-sincronizar.
- Multi-tenant real: hoy hay una sola Store, el schema lo permite pero la
  UI y `orderSync` toman la primera con `findFirst`.
- Storage S3/R2 para PDFs.
