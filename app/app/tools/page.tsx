import ToolsConsole from '@/components/app/ToolsConsole';

export default function ToolsPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-2">
      <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
          Web3 MCP · Devnet
        </p>
        <p className="mt-2 text-lg font-bold">What your Bots may call</p>
        <p className="mt-2 text-sm text-heroslate">
          Switch tools on per MCP URL. Transfer limits, allowlists, and time bounds
          are enforced before every transaction.
        </p>
      </div>
      <ToolsConsole />
    </section>
  );
}
