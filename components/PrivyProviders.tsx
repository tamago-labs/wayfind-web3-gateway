'use client';

import { PrivyProvider } from '@privy-io/react-auth';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

export default function PrivyProviders({ children }: { children: React.ReactNode }) {
  if (!appId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center font-brico text-navy">
        <h1 className="text-2xl font-extrabold">Missing Privy App ID</h1>
        <p className="mt-3 text-heroslate">
          Set <code className="rounded bg-navy/5 px-1.5 py-0.5">NEXT_PUBLIC_PRIVY_APP_ID</code> in{' '}
          <code className="rounded bg-navy/5 px-1.5 py-0.5">.env.local</code> (see Privy Dashboard) and
          restart <code className="rounded bg-navy/5 px-1.5 py-0.5">npm run dev</code>.
        </p>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      {...(clientId ? { clientId } : {})}
      // Email-only for now: external wallet login is unproven in this app.
      // Re-add wallet login + externalWallets connectors once tested.
      config={{
        loginMethods: ['email'],
        appearance: {
          walletChainType: 'solana-only',
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
