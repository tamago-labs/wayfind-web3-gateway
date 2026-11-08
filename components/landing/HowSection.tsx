const STEPS = [
  {
    n: '01',
    title: 'Add tools',
    text: 'Choose which tools your Bot can use (balances, swaps, USDC transfers).',
  },
  {
    n: '02',
    title: 'Connect',
    text: 'Generate one MCP server URL and paste it into any MCP client.',
  },
  {
    n: '03',
    title: 'Fund & authorize',
    text: 'Fund the bot wallet and choose a policy for it. You stay in control.',
  },
];

export default function HowSection() {
  return (
    <section id="how" className="scroll-mt-16 px-4 py-6 font-brico text-white sm:px-6">
      <div className="mx-auto max-w-6xl rounded-3xl bg-navy p-8 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-wider text-bamber">HOW IT WORKS</p>
        <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Built for always-on agents
        </h2>
        <p className="mt-5 max-w-3xl text-lg text-white/70">
          No private keys to manage. Your bots transact through scoped MCP tools while you keep
          ownership of the wallet.
        </p>

        <div className="mt-12 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white/5 p-7 backdrop-blur">
              <p className="font-mono text-xs font-bold text-bamber">{s.n}</p>
              <p className="mt-2 text-lg font-bold">{s.title}</p>
              <p className="mt-1 text-[15px] text-white/70">{s.text}</p>
            </div>
          ))}
          <a
            href="/app/tools"
            className="flex flex-col justify-center rounded-2xl p-7 text-navy transition-transform hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#F5A524,#E26D5A)' }}
          >
            <p className="text-lg font-bold">Open the app →</p>
            <p className="mt-1 text-[15px]">Start in under a minute.</p>
          </a>
        </div>
      </div>
    </section>
  );
}
