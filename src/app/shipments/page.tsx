import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';

export default async function ShipmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { order: { select: { orderNumber: true, customerName: true } } },
  });

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Historial de etiquetas</h1>
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Pedido</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Carrier</th>
                <th className="px-3 py-2 text-left">Tracking</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Aún no se generaron etiquetas.
                  </td>
                </tr>
              )}
              {shipments.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {s.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2">#{s.order.orderNumber}</td>
                  <td className="px-3 py-2">{s.order.customerName}</td>
                  <td className="px-3 py-2">{s.carrier}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.trackingNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        s.status === 'ERROR'
                          ? 'bg-red-100 text-red-700'
                          : s.status === 'LABEL_READY'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.errorMessage && (
                      <div className="text-red-600 text-[10px] mt-1">{s.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.labelPdfPath && (
                      <a
                        href={`/api/shipments/${s.id}/label`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Descargar PDF
                      </a>
                    )}
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
