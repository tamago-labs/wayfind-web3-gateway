'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, LogOut, X } from 'lucide-react';
import Mascot from '@/components/Mascot';

type Net = 'mainnet' | 'testnet';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  email?: string;
  wallets: { address: string }[];
  onLogout: () => void;
}

function truncate(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export default function AccountModal({ open, onClose, email, wallets, onLogout }: AccountModalProps) {
  const [net, setNet] = useState<Net>('mainnet');
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Account"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-navy/10 bg-white p-6 font-brico text-navy shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy font-brico text-base font-bold text-white">
                {email ? email.charAt(0).toUpperCase() : <Mascot color="white" size="xs" motion="none" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{email ?? 'Signed in'}</p>
                <p className="text-xs font-medium text-heroslate">Wayfind MCP account</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close account"
                className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/5 text-navy hover:bg-navy/10"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            <div className="mt-5 flex gap-2" role="tablist" aria-label="Network">
              {(['mainnet', 'testnet'] as Net[]).map((n) => (
                <button
                  key={n}
                  role="tab"
                  aria-selected={net === n}
                  onClick={() => setNet(n)}
                  className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    net === n ? 'bg-navy text-white' : 'bg-navy/5 text-navy hover:bg-navy/10'
                  }`}
                >
                  {n === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {wallets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-navy/20 p-5 text-sm text-heroslate">
                  <p className="font-bold text-navy">No Solana wallets yet.</p>
                  <p className="mt-1">
                    If you logged in with email, the embedded wallet may still be creating, wait a
                    few seconds and reopen this panel.
                  </p>
                </div>
              ) : (
                wallets.map((w) => (
                  <div
                    key={`${net}-${w.address}`}
                    className="flex items-center gap-3 rounded-2xl border border-navy/10 bg-ice p-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/solana.png" alt="Solana" className="h-7 w-7 shrink-0 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
                        Solana · {net === 'mainnet' ? 'Mainnet' : 'Testnet'}
                      </p>
                      <p className="truncate font-mono text-sm font-semibold" title={w.address}>
                        {truncate(w.address)}
                      </p>
                    </div>
                    <button
                      onClick={() => copy(w.address)}
                      aria-label={copied === w.address ? 'Copied' : 'Copy address'}
                      className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-navy shadow-sm hover:bg-navy hover:text-white transition-colors"
                    >
                      {copied === w.address ? (
                        <Check className="h-4 w-4" strokeWidth={2.2} />
                      ) : (
                        <Copy className="h-4 w-4" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                ))
              )}
              {wallets.length > 0 && (
                <p className="text-xs text-heroslate">
                  One keypair serves both networks until the gateway scopes signing.
                </p>
              )}
            </div>

            <button
              onClick={onLogout}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy px-4 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
              Log out
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
