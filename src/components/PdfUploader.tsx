'use client';

import { useRef, useState } from 'react';

interface Props {
  onUploaded: () => void;
}

export default function PdfUploader({ onUploaded }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (arr.length === 0) {
      setMsg('Solo se aceptan PDFs.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      for (const f of arr) fd.append('files', f);
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${json.error ?? 'desconocido'}`);
      } else {
        setMsg(`Procesados ${arr.length} archivos · ${json.totalUpserted} etiquetas detectadas`);
        onUploaded();
      }
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
        dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white'
      }`}
    >
      <p className="text-sm text-slate-600">
        Arrastrá los PDFs de etiquetas de Tienda Nube acá, o
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="ml-1 text-brand-600 hover:underline disabled:opacity-50"
          disabled={busy}
        >
          {busy ? 'subiendo…' : 'seleccionalos'}
        </button>
        .
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Podés subir muchos a la vez. Se detecta el operador, el destinatario, la dirección y el tipo de envío.
      </p>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
