export default function ToolsPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-2">
      <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
          Web3 MCP · Devnet
        </p>
        <p className="mt-2 text-lg font-bold">Your Bots transact here soon</p>
        <p className="mt-2 text-sm text-heroslate">
          Give your AI Bots onchain access via MCP. Transfer limits, allowlists, and time bounds
          are enforced before every transaction.
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-navy/20 p-6 text-sm text-heroslate">
        <p className="font-bold text-navy">Endpoint ships with the gateway</p>
        <p className="mt-2">
          Point your MCP client at the gateway URL, sign in with this same account, and every
          call is scoped to Devnet until Mainnet opens.
        </p>
      </div>
    </section>
  );
}
