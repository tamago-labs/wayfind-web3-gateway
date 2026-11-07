'use client';

import { useRef, useState } from 'react';
import Mascot, { type MascotColor, type MascotShape } from '@/components/Mascot';

const cards: { color: MascotColor; shape: MascotShape; title: string; body: string }[] = [
  {
    color: 'amber',
    shape: 'squircle',
    title: 'Remote MCP server',
    body: 'One hosted endpoint for all your Bots. No local machine, no private keys on your device. Always on and secure by design.',
  },
  {
    color: 'lagoon',
    shape: 'circle',
    title: 'Privy Delegated Signing',
    body: 'Use email to get a bot wallet. Your bot gets a restricted signer under policies you approve. Revoke anytime.',
  },
  {
    color: 'moss',
    shape: 'pebble',
    title: 'Every model. Every agent.',
    body: 'Compatible with Claude, Grok Bot, and others right out of the box. Works with Wayfind Cloud and any MCP client.',
  },
];

export default function Features() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    setIdx(Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (cards.length - 1)));
  };

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: (i / (cards.length - 1)) * (el.scrollWidth - el.clientWidth), behavior: 'smooth' });
  };

  return (
    <section id="features" className="scroll-mt-16 bg-ice px-6 py-24 font-brico text-navy">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-wider text-cta">Features</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Built for Bots that move money safely.
        </h2>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((c, i) => (
            <div key={c.title} className="min-w-[85%] snap-center rounded-3xl bg-white p-7 shadow-sm sm:min-w-[60%] md:min-w-0">
              <Mascot color={c.color} shape={c.shape} size="md" motion="none" blinkDelay={`-${i * 1.4}s`} />
              <h3 className="mt-5 text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-heroslate">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-2 md:hidden" role="tablist" aria-label="Feature cards">
          {cards.map((c, i) => (
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
