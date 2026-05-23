'use client';

import { useEffect, useMemo, useState } from 'react';
import PdfUploader from './PdfUploader';

type Carrier = 'CORREO_ARGENTINO' | 'SINERGIA' | 'OTRO';
type ShippingMode = 'HOME' | 'PICKUP_BRANCH';

interface OrderRow {
  id: string;
  orderNumber: string;
  packageNumber: string | null;
  carrier: Carrier;
  shippingMode: ShippingMode;
  exported: boolean;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientDni: string | null;
  shipStreet: string | null;
  shipNumber: string | null;
  shipFloor: string | null;
  shipApartment: string | null;
  shipLocality: string | null;
  shipProvince: string | null;
  shipProvinceCode: string | null;
  shipPostalCode: string | null;
  pickupBranchName: string | null;
  pickupBranchCode: string | null;
  productsSummary: string | null;
  flexId: string | null;
  weightKg: number | null;
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCarrier, setFilterCarrier] = useState<'ALL' | Carrier>('ALL');
  const [filterExported, setFilterExported] = useState<'all' | 'true' | 'false'>('false');
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCarrier !== 'ALL') params.set('carrier', filterCarrier);
    if (filterExported !== 'all') params.set('exported', filterExported);
    const res = await fetch(`/api/orders?${params}`);
    const json = await res.json();
    setOrders(json.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCarrier, filterExported]);

  async function patch(id: string, partial: Partial<OrderRow>) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const { order } = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...order } : o)));
    }
  }

  async function removeOne(id: string) {
    if (!confirm('¿Eliminar este pedido?')) return;
    await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const visibleIds = orders.map((o) => o.id);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(visibleIds));
  }

  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const correoCount = selectedOrders.filter((o) => o.carrier === 'CORREO_ARGENTINO').length;
  const sinergiaCount = selectedOrders.filter((o) => o.carrier === 'SINERGIA').length;

  async function exportPlatform(platform: 'correo-argentino' | 'sinergia', dryRun = false) {
    const ids =
      platform === 'correo-argentino'
        ? selectedOrders.filter((o) => o.carrier === 'CORREO_ARGENTINO').map((o) => o.id)
        : selectedOrders.filter((o) => o.carrier === 'SINERGIA').map((o) => o.id);
    if (ids.length === 0) {
      setIssues([`No hay pedidos seleccionados para ${platform === 'correo-argentino' ? 'Correo Argentino' : 'Sinergia'}.`]);
      return;
    }
    setBusy(true);
    setIssues([]);
    try {
      const res = await fetch(`/api/exports/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids, dryRun }),
      });
      if (dryRun) {
        const json = await res.json();
        setIssues(json.issues ?? []);
      } else if (res.status === 422) {
        const json = await res.json();
        setIssues(json.details ?? [json.error]);
      } else if (!res.ok) {
        const txt = await res.text();
        setIssues([`Error ${res.status}: ${txt.slice(0, 200)}`]);
      } else {
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') ?? '';
        const fileName = cd.match(/filename="(.+?)"/)?.[1] ?? `export.${platform === 'correo-argentino' ? 'csv' : 'xlsx'}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        setSelected(new Set());
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const Cell = ({
    value,
    onChange,
    placeholder,
    width = 'w-28',
  }: {
    value: string | null;
    onChange: (v: string) => void;
    placeholder?: string;
    width?: string;
  }) => (
    <input
      defaultValue={value ?? ''}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value;
        if (v !== (value ?? '')) onChange(v);
      }}
      className={`${width} rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-brand-500 focus:outline-none`}
    />
  );

  const carrierBadge = (c: Carrier) => {
    const styles: Record<Carrier, string> = {
      CORREO_ARGENTINO: 'bg-blue-100 text-blue-800',
      SINERGIA: 'bg-purple-100 text-purple-800',
      OTRO: 'bg-slate-100 text-slate-700',
    };
    return styles[c];
  };

  return (
    <div className="space-y-4">
      <PdfUploader onUploaded={load} />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCarrier}
          onChange={(e) => setFilterCarrier(e.target.value as typeof filterCarrier)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Todos los operadores</option>
          <option value="CORREO_ARGENTINO">Correo Argentino</option>
          <option value="SINERGIA">Sinergia</option>
          <option value="OTRO">Otro</option>
        </select>
        <select
          value={filterExported}
          onChange={(e) => setFilterExported(e.target.value as typeof filterExported)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="false">No exportados</option>
          <option value="true">Ya exportados</option>
        </select>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={busy || selected.size === 0}
            onClick={() => exportPlatform('correo-argentino', true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Verifica datos sin generar archivo"
          >
            Validar selección
          </button>
          <button
            disabled={busy || correoCount === 0}
            onClick={() => exportPlatform('correo-argentino')}
            className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Exportar Correo Argentino ({correoCount})
          </button>
          <button
            disabled={busy || sinergiaCount === 0}
            onClick={() => exportPlatform('sinergia')}
            className="rounded-lg bg-purple-600 text-white px-3 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            Exportar Sinergia ({sinergiaCount})
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-900">Datos faltantes / inválidos:</div>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
            {issues.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-2">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Operador</th>
              <th className="px-2 py-2 text-left">Modo</th>
              <th className="px-2 py-2 text-left">Destinatario</th>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Teléfono</th>
              <th className="px-2 py-2 text-left">DNI</th>
              <th className="px-2 py-2 text-left">Calle / Sucursal</th>
              <th className="px-2 py-2 text-left">Nº</th>
              <th className="px-2 py-2 text-left">Piso/Dto</th>
              <th className="px-2 py-2 text-left">Localidad</th>
              <th className="px-2 py-2 text-left">Prov.</th>
              <th className="px-2 py-2 text-left">CP</th>
              <th className="px-2 py-2 text-left">Suc. CA</th>
              <th className="px-2 py-2 text-left">FLEX</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={17} className="py-8 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={17} className="py-8 text-center text-slate-400">
                  Sin pedidos. Subí PDFs arriba para empezar.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-slate-50">
                <td className="px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                </td>
                <td className="px-2 py-1 font-medium">
                  {o.orderNumber}
                  {o.packageNumber && o.packageNumber !== '1' ? `/${o.packageNumber}` : ''}
                  {o.exported && (
                    <span className="ml-1 inline-block rounded bg-emerald-100 px-1 text-[9px] text-emerald-700">
                      EXP
                    </span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <select
                    value={o.carrier}
                    onChange={(e) => patch(o.id, { carrier: e.target.value as Carrier })}
                    className={`rounded px-1.5 py-0.5 text-[11px] ${carrierBadge(o.carrier)}`}
                  >
                    <option value="CORREO_ARGENTINO">Correo Arg.</option>
                    <option value="SINERGIA">Sinergia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={o.shippingMode}
                    onChange={(e) => patch(o.id, { shippingMode: e.target.value as ShippingMode })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                  >
                    <option value="HOME">Domicilio</option>
                    <option value="PICKUP_BRANCH">Sucursal</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.recipientName}
                    onChange={(v) => patch(o.id, { recipientName: v })}
                    width="w-32"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.recipientEmail}
                    onChange={(v) => patch(o.id, { recipientEmail: v })}
                    width="w-36"
                    placeholder="obligatorio CA"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.recipientPhone}
                    onChange={(v) => patch(o.id, { recipientPhone: v })}
                    width="w-28"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.recipientDni}
                    onChange={(v) => patch(o.id, { recipientDni: v })}
                    width="w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  {o.shippingMode === 'PICKUP_BRANCH' ? (
                    <span className="text-slate-600">{o.pickupBranchName ?? '—'}</span>
                  ) : (
                    <Cell
                      value={o.shipStreet}
                      onChange={(v) => patch(o.id, { shipStreet: v })}
                      width="w-32"
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.shipNumber}
                    onChange={(v) => patch(o.id, { shipNumber: v })}
                    width="w-14"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={
                      [o.shipFloor, o.shipApartment].filter(Boolean).join(' ') || null
                    }
                    onChange={(v) => {
                      const parts = v.split(/\s+/);
                      patch(o.id, { shipFloor: parts[0] ?? '', shipApartment: parts[1] ?? '' });
                    }}
                    width="w-16"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.shipLocality}
                    onChange={(v) => patch(o.id, { shipLocality: v })}
                    width="w-28"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.shipProvinceCode ?? o.shipProvince}
                    onChange={(v) => patch(o.id, { shipProvince: v })}
                    width="w-16"
                    placeholder="prov"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.shipPostalCode}
                    onChange={(v) => patch(o.id, { shipPostalCode: v })}
                    width="w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.pickupBranchCode}
                    onChange={(v) => patch(o.id, { pickupBranchCode: v })}
                    width="w-16"
                    placeholder={o.shippingMode === 'PICKUP_BRANCH' ? 'cód.' : ''}
                  />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={o.flexId}
                    onChange={(v) => patch(o.id, { flexId: v })}
                    width="w-16"
                    placeholder="flex"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    onClick={() => removeOne(o.id)}
                    className="text-[10px] text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
