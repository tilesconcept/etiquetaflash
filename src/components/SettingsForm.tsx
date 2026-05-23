'use client';

import { useEffect, useState } from 'react';

interface Settings {
  defaultWeightKg: number;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  originName: string;
  originStreet: string;
  originNumber: string;
  originCity: string;
  originProvince: string;
  originPostalCode: string;
  originPhone: string;
  originEmail: string;
  preferredCarrier: 'CORREO_ARGENTINO' | 'SINERGIA';
}

const empty: Settings = {
  defaultWeightKg: 1,
  defaultLengthCm: 20,
  defaultWidthCm: 15,
  defaultHeightCm: 10,
  originName: '',
  originStreet: '',
  originNumber: '',
  originCity: '',
  originProvince: '',
  originPostalCode: '',
  originPhone: '',
  originEmail: '',
  preferredCarrier: 'CORREO_ARGENTINO',
};

export default function SettingsForm() {
  const [data, setData] = useState<Settings>(empty);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json?.store?.settings) {
          const s = json.store.settings as Settings;
          setData({ ...empty, ...s });
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setMsg(null);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setMsg(res.ok ? 'Guardado correctamente' : `Error: ${json.error ?? 'desconocido'}`);
  }

  if (loading) return <p className="text-slate-500">Cargando…</p>;

  const field = (
    label: string,
    key: keyof Settings,
    type: 'text' | 'number' | 'email' = 'text',
  ) => (
    <div>
      <label className="block text-sm text-slate-600">{label}</label>
      <input
        type={type}
        value={String(data[key] ?? '')}
        onChange={(e) =>
          setData({
            ...data,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Paquete por defecto</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {field('Peso (kg)', 'defaultWeightKg', 'number')}
          {field('Largo (cm)', 'defaultLengthCm', 'number')}
          {field('Ancho (cm)', 'defaultWidthCm', 'number')}
          {field('Alto (cm)', 'defaultHeightCm', 'number')}
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Dirección de origen / remitente</h2>
        <div className="grid grid-cols-2 gap-3">
          {field('Nombre', 'originName')}
          {field('Email', 'originEmail', 'email')}
          {field('Calle', 'originStreet')}
          {field('Número', 'originNumber')}
          {field('Ciudad', 'originCity')}
          {field('Provincia', 'originProvince')}
          {field('Código postal', 'originPostalCode')}
          {field('Teléfono', 'originPhone')}
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Operador logístico preferido</h2>
        <select
          value={data.preferredCarrier}
          onChange={(e) =>
            setData({ ...data, preferredCarrier: e.target.value as Settings['preferredCarrier'] })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="CORREO_ARGENTINO">Correo Argentino</option>
          <option value="SINERGIA">Sinergia</option>
        </select>
        <p className="text-xs text-slate-500">
          Las credenciales de cada operador se configuran en variables de entorno
          (<code>.env</code>), no acá.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          Guardar
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
