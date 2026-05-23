import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import OrdersTable from '@/components/OrdersTable';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Pedidos pendientes</h1>
        <OrdersTable />
      </main>
    </>
  );
}
