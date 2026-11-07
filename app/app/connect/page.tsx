import McpAccessCard from '@/components/app/McpAccessCard';

export default function ConnectPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-2">
      <McpAccessCard />
      <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
          Solana · Devnet
        </p>
        <p className="mt-2 text-lg font-bold">Wallets connect on login</p>
          <p className="mt-2 text-sm text-heroslate">
            Email login creates a Solana embedded wallet automatically. Your addresses live under
            the account button at the bottom of the sidebar.
          </p>
      </div>
      <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
          <p className="font-bold text-navy">More wallets arrive with the gateway</p>
          <p className="mt-2">
            External wallets will be linkable here later. Delegated signing stays scoped to Devnet
            until Mainnet opens.
          </p>
      </div>
    </section>
  );
}
