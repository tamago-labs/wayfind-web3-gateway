'use client';

import { useRef, useState } from 'react';

const cases: { n: string; color: string; title: string; body: string }[] = [
  {
    n: '01',
    color: 'border-cta',
    title: 'Wallet Operations',
    body: 'Check balances, track transactions and send tokens.',
  },
  {
    n: '02',
    color: 'border-bamber',
    title: 'DEX Swaps',
    body: 'Find routes and swap tokens through OKX DEX.',
  },
  {
    n: '03',
    color: 'border-blagoon',
    title: 'Stablecoin Finance',
    body: 'Bridge, swap stablecoins and access supported lending protocols.',
  },
  {
    n: '04',
    color: 'border-bgrape',
    title: 'DeFi & Earn',
    body: 'Deposit supported assets into lending protocols.',
  },
];

const textColors: Record<string, string> = {
  'border-cta': 'text-cta',
  'border-bamber': 'text-bamber',
  'border-blagoon': 'text-blagoon',
  'border-bgrape': 'text-bgrape',
};

export default function UseCases() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    setIdx(Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (cases.length - 1)));
  };

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: (i / (cases.length - 1)) * (el.scrollWidth - el.clientWidth), behavior: 'smooth' });
  };

  return (
    <section id="usecases" className="scroll-mt-16 px-6 py-24 font-brico text-navy" style={{ background: 'linear-gradient(180deg,#E9F1FA,#FFFFFF)' }}>
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-wider text-cta">What your Bots can do</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Give your Bots onchain superpowers.
        </h2>
        <p className="mt-5 max-w-3xl text-lg text-heroslate">
          From everyday wallet operations to DeFi strategies, your Bots can do more than just read
          blockchain data.
        </p>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-12 flex snap-x snap-mandatory gap-8 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
        >
          {cases.map((c) => (
            <article key={c.title} className={`min-w-[85%] snap-center border-t-2 ${c.color} pt-4 sm:min-w-[60%] md:min-w-0`}>
              <p className={`font-mono text-sm font-bold ${textColors[c.color]}`}>{c.n}</p>
              <h3 className="mt-1 text-xl font-bold">{c.title}</h3>
              <p className="mt-1 text-sm text-heroslate">{c.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-2 md:hidden" role="tablist" aria-label="Use case cards">
          {cases.map((c, i) => (
            <button
              key={c.title}
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show: ${c.title}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-cta' : 'w-2 bg-navy/20'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
