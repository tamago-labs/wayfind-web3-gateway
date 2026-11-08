import ToolsConsole from '@/components/app/ToolsConsole';

const STEPS = [
  { n: '01', title: 'Add tools', text: 'Pick the tools your Bots may call.' },
  { n: '02', title: 'Connect', text: 'Generate your MCP server URL.' },
  { n: '03', title: 'Fund & authorize', text: 'Fund the wallet and choose a policy.' },
  { n: '04', title: 'Use it in your client', text: 'Ask Grok Bot, Claude, or Cursor to act.' },
];

export default function ToolsPage() {
  return (
    <section className="mx-auto max-w-5xl pt-2">
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div
          className="rounded-3xl p-6 text-white shadow-sm lg:sticky lg:top-4 lg:col-span-2"
          style={{
            background: 'linear-gradient(150deg, #0E1B2C 0%, #1B2A4A 55%, #2F7BFF 160%)',
          }}
        >
          <p className="mt-2 text-xl font-extrabold tracking-tight">Get your Bots working</p>
          <p className="mt-1 text-sm text-white/70">4 steps to live Bots.</p>
          <div className="mt-5 space-y-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
                <p className="font-mono text-xs font-bold text-bamber">{s.n}</p>
                <div>
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="text-xs text-white/70">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3">
          <ToolsConsole />
        </div>
      </div>
    </section>
  );
}
