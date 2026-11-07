'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, Plug, ScrollText, ShieldCheck, Wrench } from 'lucide-react';
import Mascot from '@/components/Mascot';
import AccountModal from './AccountModal';

const NAV: { href: string; label: string; icon: typeof Wrench }[] = [
  { href: '/app/tools', label: 'Tools', icon: Wrench },
  { href: '/app/connect', label: 'Connect', icon: Plug },
  { href: '/app/authorization', label: 'Authorization', icon: ShieldCheck },
  { href: '/app/logs', label: 'Logs', icon: ScrollText },
];

export interface SidebarWallet {
  address: string;
  embedded: boolean;
}

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  email?: string;
  wallets: SidebarWallet[];
  onLogout: () => void;
}

export default function AppSidebar({
  open,
  onClose,
  email,
  wallets,
  onLogout,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
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
          <span className="truncate font-brico text-lg font-bold leading-tight text-navy">
            Wayfind MCP
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
          <button
            onClick={() => setAccountOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-colors hover:bg-navy/5"
            aria-haspopup="dialog"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy font-brico text-sm font-bold text-white">
              {email ? email.charAt(0).toUpperCase() : 'W'}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">
              {email ?? 'Signed in'}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-heroslate" strokeWidth={2.2} />
          </button>
        </div>
      </aside>

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        email={email}
        wallets={wallets}
        onLogout={() => {
          setAccountOpen(false);
          onLogout();
        }}
      />
    </>
  );
}
