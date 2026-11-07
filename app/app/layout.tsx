'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Wallet } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Mascot from '@/components/Mascot';
import AppSidebar from '@/components/app/AppSidebar';

const TITLES: Record<string, { title: string; hint: string }> = {
  '/app/tools': {
    title: 'Tools',
    hint: 'The Web3 MCP your AI Bots call. Balances and signing arrive with the gateway.',
  },
  '/app/connect': {
    title: 'Connect',
    hint: 'Solana wallets owned by this account. Embedded wallets are created on login.',
  },
  '/app/authorization': {
    title: 'Authorization',
    hint: 'Approve what your AI Bots may do. Limits and allowlists live here.',
  },
  '/app/logs': {
    title: 'Logs',
    hint: 'Every delegated transaction lands here once the gateway is live.',
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaHookWallets } = useSolanaWallets();
  const [sideOpen, setSideOpen] = useState(false);
  const pathname = usePathname();
  const { title, hint } = TITLES[pathname] ?? TITLES['/app/tools'];

  // Embedded = created by Privy (walletClientType 'privy'); anything else is an
  // external wallet the user connected. Source: user.linkedAccounts.
  const embeddedByAddress = useMemo(() => {
    const map: Record<string, boolean> = {};
    const accounts = (user?.linkedAccounts ?? []) as Array<{
      type: string;
      address?: string;
      walletClientType?: string;
    }>;
    for (const a of accounts) {
      if (a.type === 'wallet' && a.address) map[a.address] = a.walletClientType === 'privy';
    }
    return map;
  }, [user]);

  const solanaWallets = useMemo(() => {
    const fromHook = solanaHookWallets.filter((w) => w.address);
    const list = fromHook.length > 0 ? fromHook : wallets.filter((w) => w.address);
    // Fallback: app is solana-only, so any wallet here is treated as Solana.
    // Email-only login: show embedded wallets, filter out any legacy external ones.
    return list
      .map((w) => ({
        address: w.address as string,
        embedded: embeddedByAddress[w.address as string] ?? false,
      }))
      .filter((w) => w.embedded);
  }, [wallets, solanaHookWallets, embeddedByAddress]);

  if (!ready) {
    return (
      <main className="grid h-screen place-items-center bg-ice font-brico text-navy">
        <p className="text-heroslate">Loading wallet…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid h-screen place-items-center overflow-y-auto bg-ice px-4 font-brico text-navy">
        <div className="w-full max-w-md rounded-3xl border border-navy/10 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-navy">
            <Mascot color="white" size="xs" motion="none" label="Wayfind mascot" />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-heroslate">
            Wayfind Web3 Gateway
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Set Up Your MCP Server</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-heroslate">
            Login with email secured by Privy. Then set up the MCP server endpoint to
            use in your Bots.
          </p>
          <button
            onClick={login}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cta px-8 py-3.5 font-semibold text-white transition-colors hover:bg-ctahover"
          >
            <Wallet className="h-4 w-4" strokeWidth={2.2} />
            Log in
          </button>
          <p className="mt-5">
            <Link href="/" className="text-sm font-semibold text-cta hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ice font-brico text-navy">
      <AppSidebar
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        email={user?.email?.address}
        wallets={solanaWallets}
        onLogout={logout}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-thread">
        <header className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
          <button
            onClick={() => setSideOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-navy shadow-sm md:hidden"
          >
            <Menu className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
            <p className="hidden truncate text-sm text-heroslate sm:block">{hint}</p>
          </div>
          <div className="ml-auto" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
