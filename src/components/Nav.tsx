'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Pedidos' },
  { href: '/exports', label: 'Historial' },
  { href: '/settings', label: 'Configuración' },
];

export function Nav() {
  const pathname = usePathname();
  const { data } = useSession();
  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-bold text-brand-900">
            EtiquetaFlash
          </Link>
          <nav className="flex gap-2">
            {items.map((i) => {
              const active = pathname === i.href || pathname?.startsWith(i.href + '/');
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{data?.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-700 hover:text-red-600"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
