import Link from 'next/link';
import Mascot, { type MascotColor } from '@/components/Mascot';

const mascots: MascotColor[] = ['amber', 'moss', 'lagoon', 'ash'];

export default function FinalCta() {
  return (
    <section className="bg-ice px-6 py-24 font-brico">
      <div className="mx-auto max-w-4xl rounded-[2rem] bg-navy px-8 py-16 text-center text-white">
        <div className="mb-6 flex justify-center -space-x-3">
          {mascots.map((color, i) => (
            <Mascot
              key={color}
              color={color}
              size="md"
              motion="none"
              blinkDelay={`-${i * 1.4}s`}
              className="ring-4 ring-navy"
            />
          ))}
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Put your Bots on-chain today.</h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/70">
          10+ tools for wallets, swaps, and stablecoins, running 24/7. Free to start — connect your first client in under a minute.
        </p>
        <Link
          href="/app"
          className="mt-8 inline-block rounded-full bg-cta px-8 py-4 font-semibold text-white hover:bg-ctahover transition-colors"
        >
          Connect your first client
        </Link>
      </div>
    </section>
  );
}
