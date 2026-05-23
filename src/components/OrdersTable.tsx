'use client';

import { useEffect, useMemo, useState } from 'react';

interface ShipmentSummary {
  id: string;
  carrier: string;
  status: string;
  trackingNumber: string | null;
  labelPdfPath: string | null;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  shipCity: string | null;
  shipProvince: string | null;
  shipPostalCode: string | null;
  shippingStatus: string;
  labelGenerated: boolean;
  totalAmount: number;
  currency: string;
  shipments: ShipmentSummary[];
}

type Filters = {
  labelGenerated: 'all' | 'true' | 'false';
};

export default function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ labelGenerated: 'all' });
  const [batchCarrier, setBatchCarrier] = useState<'CORREO_ARGENTINO' | 'SINERGIA'>('CORREO_ARGENTINO');
  const [message, setMessage] = useState<string | null>(null);

  async function load(refresh = false) {
    setLoading(true);
    const params = new URLSearchParams();
    if (refresh) params.set('refresh', 'true');
    if (filters.labelGenerated !== 'all') params.set('labelGenerated', filters.labelGenerated);
    const res = await fetch(`/api/tiendanube/orders?${params.toString()}`);
    const json = await res.json();
    setOrders(json.orders ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.labelGenerated]);

  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  async function generateOne(orderId: string, carrier: 'CORREO_ARGENTINO' | 'SINERGIA') {
    setMessage(null);
    const res = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderInternalId: orderId, carrier }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${json.error ?? 'desconocido'}${json.details ? ' · ' + JSON.stringify(json.details) : ''}`);
    } else {
      setMessage(`Etiqueta generada · tracking ${json.trackingNumber}`);
      await load(false);
    }
  }

  async function generateBatch() {
    if (selected.size === 0) return;
    setMessage(null);
    const res = await fetch('/api/shipments/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderInternalIds: Array.from(selected), carrier: batchCarrier }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${json.error ?? 'desconocido'}`);
    } else {
      const ok = json.results.filter((r: { ok: boolean }) => r.ok).length;
      const fail = json.results.length - ok;
      setMessage(`Lote terminado: ${ok} OK · ${fail} con error`);
      setSelected(new Set());
      await load(false);
    }
  }

  const allChecked = useMemo(
    () => orders.length > 0 && selected.size === orders.length,
    [orders, selected],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            setRefreshing(true);
            await load(true);
          }}
          className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          disabled={refreshing}
        >
          {refreshing ? 'Sincronizando…' : 'Sincronizar Tienda Nube'}
        </button>

        <select
          value={filters.labelGenerated}
          onChange={(e) => setFilters({ ...filters, labelGenerated: e.target.value as Filters['labelGenerated'] })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="false">Sin etiqueta</option>
          <option value="true">Con etiqueta</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={batchCarrier}
            onChange={(e) => setBatchCarrier(e.target.value as typeof batchCarrier)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="CORREO_ARGENTINO">Correo Argentino</option>
            <option value="SINERGIA">Sinergia</option>
          </select>
          <button
            onClick={generateBatch}
            disabled={selected.size === 0}
            className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            Generar etiquetas en lote ({selected.size})
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Destino</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Etiqueta</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  No hay pedidos. Probá &quot;Sincronizar Tienda Nube&quot;.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const lastShipment = o.shipments[0];
              return (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                      disabled={o.labelGenerated}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{o.orderNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-slate-500">{o.customerPhone ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{o.shipCity ?? '—'}, {o.shipProvince ?? ''}</div>
                    <div className="text-xs text-slate-500">CP {o.shipPostalCode ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    {o.currency} {o.totalAmount.toLocaleString('es-AR')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100">{o.shippingStatus}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o.labelGenerated ? (
                      <a
                        href={lastShipment ? `/api/shipments/${lastShipment.id}/label` : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline"
                      >
                        Descargar PDF ({lastShipment?.trackingNumber})
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!o.labelGenerated && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => generateOne(o.id, 'CORREO_ARGENTINO')}
                          className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50"
                        >
                          Correo
                        </button>
                        <button
                          onClick={() => generateOne(o.id, 'SINERGIA')}
                          className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50"
                        >
                          Sinergia
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
