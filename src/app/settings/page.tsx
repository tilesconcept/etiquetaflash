import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Nav } from '@/components/Nav';
import SettingsForm from '@/components/SettingsForm';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Configuración</h1>
        <SettingsForm />
      </main>
    </>
  );
}
