'use client';

import { useEffect, useState } from 'react';

interface Settings {
  defaultProductType: 'CP' | 'EP' | 'UP';
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  defaultWeightKg: number;
  defaultContentValue: number;
  defaultFlexId: string;
  originName: string;
  originStreet: string;
  originNumber: string;
  originCity: string;
  originProvince: string;
  originPostalCode: string;
  originPhone: string;
  originEmail: string;
}

const empty: Settings = {
  defaultProductType: 'CP',
  defaultLengthCm: 20,
  defaultWidthCm: 15,
  defaultHeightCm: 10,
  defaultWeightKg: 1,
  defaultContentValue: 0,
  defaultFlexId: 'flex',
  originName: '',
  originStreet: '',
  originNumber: '',
  originCity: '',
  originProvince: '',
  originPostalCode: '',
  originPhone: '',
  originEmail: '',
};

export default function SettingsForm() {
  const [data, setData] = useState<Settings>(empty);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json?.settings) setData({ ...empty, ...(json.settings as Settings) });
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

  const text = (label: string, key: keyof Settings, placeholder?: string) => (
    <div>
      <label className="block text-xs text-slate-600">{label}</label>
      <input
        value={String(data[key] ?? '')}
        placeholder={placeholder}
        onChange={(e) => setData({ ...data, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
  const num = (label: string, key: keyof Settings) => (
    <div>
      <label className="block text-xs text-slate-600">{label}</label>
      <input
        type="number"
        value={String(data[key] ?? '')}
        onChange={(e) => setData({ ...data, [key]: Number(e.target.value) })}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Paquete por defecto</h2>
        <p className="text-xs text-slate-500">
          Se aplica a cada envío si la etiqueta no trae el dato. Podés sobreescribir por pedido en la tabla.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-600">Tipo producto (Correo Arg.)</label>
            <select
              value={data.defaultProductType}
              onChange={(e) =>
                setData({ ...data, defaultProductType: e.target.value as Settings['defaultProductType'] })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="CP">CP — PAQ.AR Clásico</option>
              <option value="EP">EP — PAQ.AR Expreso</option>
              <option value="UP">UP — PAQ.AR Hoy</option>
            </select>
          </div>
          {num('Largo (cm)', 'defaultLengthCm')}
          {num('Ancho (cm)', 'defaultWidthCm')}
          {num('Alto (cm)', 'defaultHeightCm')}
          {num('Peso (kg)', 'defaultWeightKg')}
          {num('Valor del contenido (ARS)', 'defaultContentValue')}
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Sinergia</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {text('ID FLEX por defecto', 'defaultFlexId', 'flex')}
        </div>
        <p className="text-xs text-slate-500">
          La columna “ID FLEX” es obligatoria en el formulario de carga masiva de Sinergia. Si tus envíos
          son FLEX basta con poner la palabra <code>flex</code>; podés editarlo por pedido en la tabla.
        </p>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold">Remitente (informativo)</h2>
        <p className="text-xs text-slate-500">
          Estos datos no se incluyen en el Excel de carga masiva (cada plataforma usa el remitente del contrato),
          pero te sirven como referencia.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {text('Nombre', 'originName')}
          {text('Email', 'originEmail')}
          {text('Calle', 'originStreet')}
          {text('Número', 'originNumber')}
          {text('Ciudad', 'originCity')}
          {text('Provincia', 'originProvince')}
          {text('Código postal', 'originPostalCode')}
          {text('Teléfono', 'originPhone')}
        </div>
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
