const points = [
  {
    title: 'You remain the owner',
    body: 'Your wallet stays under your ownership.',
  },
  {
    title: 'Restricted signing',
    body: 'Authorize signers with policies and spending limits.',
  },
  {
    title: 'Choose what Bots can do',
    body: 'Enable only the connectors and operations you trust.',
  },
  {
    title: 'Revoke anytime',
    body: 'Remove delegated signing authorization when needed.',
  },
];

export default function Connectors() {
  return (
    <section id="connectors" className="scroll-mt-16 px-6 py-24 font-brico text-navy" style={{ background: 'linear-gradient(180deg,#E9F1FA,#FFFFFF)' }}>
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-cta">Ownership & control</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your wallet. Your rules.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-heroslate">
            Give your Bots the freedom to transact without giving up control of your assets.
          </p>
          <div className="mt-6 overflow-hidden rounded-3xl border border-navy/10 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://framerusercontent.com/images/ATnDBP0kodNf8gyDEdTYKGllNA0.png?scale-down-to=1024&width=1836&height=1188"
              alt="Privy"
              className="w-full object-cover"
              loading="lazy"
            />
            <p className="p-3 text-xs text-heroslate">Delegated signing secured by Privy.</p>
          </div>
        </div>
        <div className="space-y-4">
          {points.map((p) => (
            <div key={p.title} className="rounded-2xl border border-navy/10 bg-white p-5">
              <p className="font-bold">{p.title}</p>
              <p className="mt-1 text-sm text-heroslate">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
