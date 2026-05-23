import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';

export default async function ExportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const exports = await prisma.export.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Historial de exportaciones</h1>
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-left">Archivo</th>
                <th className="px-3 py-2 text-left">Filas</th>
                <th className="px-3 py-2 text-left">Generado por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {exports.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Todavía no exportaste ningún archivo.
                  </td>
                </tr>
              )}
              {exports.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        e.platform === 'CORREO_ARGENTINO'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {e.platform === 'CORREO_ARGENTINO' ? 'Correo Argentino' : 'Sinergia'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.fileName}</td>
                  <td className="px-3 py-2">{e.rowCount}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{e.user?.email ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`/api/exports/${e.id}/download`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Descargar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
