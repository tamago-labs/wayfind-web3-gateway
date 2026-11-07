'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Plug, ScrollText, ShieldCheck, Wrench } from 'lucide-react';
import Mascot from '@/components/Mascot';

export type Cluster = 'devnet' | 'mainnet-beta';

const NAV: { href: string; label: string; icon: typeof Wrench }[] = [
  { href: '/app/tools', label: 'Tools', icon: Wrench },
  { href: '/app/connect', label: 'Connect', icon: Plug },
  { href: '/app/authorization', label: 'Authorization', icon: ShieldCheck },
  { href: '/app/logs', label: 'Logs', icon: ScrollText },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  email?: string;
  cluster: Cluster;
  onLogout: () => void;
}

export default function AppSidebar({
  open,
  onClose,
  email,
  cluster,
  onLogout,
}: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-20 bg-navy/40 md:hidden ${open ? '' : 'hidden'}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[19rem] flex-col border-r border-navy/10 bg-ice transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6" aria-label="Back to Wayfind home">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy">
            <Mascot color="white" size="xs" motion="none" label="Wayfind mascot" />
          </span>
          <span className="leading-tight">
            <span className="block font-brico text-lg font-bold text-navy">Wayfind</span>
            <span className="block text-xs font-medium text-heroslate">Web3 Gateway</span>
          </span>
        </Link>

        <nav className="space-y-1 px-3" aria-label="App sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href === '/app/tools' && pathname === '/app');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
                  active ? 'bg-navy text-white' : 'text-navy hover:bg-navy/5'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="border-t border-navy/10 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="truncate text-sm font-bold text-navy">{email ?? 'Signed in'}</p>
            <p className="mt-1 text-xs font-semibold text-heroslate">
              Scope: {cluster === 'devnet' ? 'Devnet' : 'Mainnet'}
            </p>
            <button
              onClick={onLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy px-4 py-2 text-xs font-bold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
