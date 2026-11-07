'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CATALOG } from './toolsCatalog';
import type { ToolConfig } from './ToolsConsole';

function shortAddress(c: ToolConfig): string {
  return `${(c.walletAddress ?? c.walletId).slice(0, 8)}…`;
}

function scopeLabel(c: ToolConfig): string {
  return c.network === 'mainnet' ? 'Mainnet' : 'Testnet';
}

export default function AddToolsModal({
  open,
  onClose,
  configs,
  onAdd,
  onAddAll,
  busyKey,
}: {
  open: boolean;
  onClose: () => void;
  configs: ToolConfig[];
  onAdd: (serverIdHash: string, tool: string) => void;
  onAddAll: (serverIdHash: string, tools: string[]) => void;
  busyKey: string | null;
}) {
  const [targetHash, setTargetHash] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Reset the drill-down each time the modal opens.
  useEffect(() => {
    if (open) {
      setTargetHash(configs.length === 1 ? configs[0].serverIdHash : null);
      setCategoryId(null);
    }
  }, [open, configs]);

  const target = useMemo(
    () => configs.find((c) => c.serverIdHash === targetHash) ?? null,
    [configs, targetHash],
  );
  const category = useMemo(
    () => CATALOG.find((c) => c.id === categoryId) ?? null,
    [categoryId],
  );

  const needsTarget = configs.length > 1 && !target;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add tools"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-lg rounded-3xl border border-navy/10 bg-white p-6 font-brico text-navy shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-bold">
            {needsTarget
              ? 'Which wallet gets the tools?'
              : category
                ? category.label
                : 'Add tools'}
          </p>
          <button
            onClick={onClose}
            aria-label="Close add tools"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/5 text-navy hover:bg-navy/10"
          >
            ✕
          </button>
        </div>

        {target && !needsTarget && configs.length > 1 && (
          <p className="mt-1 text-xs text-heroslate">
            <button
              onClick={() => setTargetHash(null)}
              className="font-semibold text-cta hover:underline"
            >
              Change wallet
            </button>
          </p>
        )}

        <div className="mt-4">
          {needsTarget ? (
            <ul className="space-y-2">
              {configs.map((c) => (
                <li key={c.serverIdHash}>
                  <button
                    onClick={() => setTargetHash(c.serverIdHash)}
                    className="w-full rounded-2xl border border-navy/15 p-4 text-left hover:bg-navy/5"
                  >
                    <p className="font-mono font-semibold">{shortAddress(c)}</p>
                    <p className="text-xs text-heroslate">
                      {scopeLabel(c)} · {c.enabledTools.length} tools enabled
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : !category ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {CATALOG.map((cat) => (
                <button
                  key={cat.id}
                  disabled={cat.comingSoon}
                  onClick={() => setCategoryId(cat.id)}
                  className="rounded-2xl border border-navy/15 p-4 text-left hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cat.icon}
                      alt={`${cat.label} icon`}
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                    <p className="font-bold">{cat.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-heroslate">
                    {cat.comingSoon ? 'Coming soon' : `${cat.tools.length} tools`}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setCategoryId(null)}
                  className="text-xs font-bold text-cta hover:underline"
                >
                  ← All categories
                </button>
                {(() => {
                  const missing = category.tools.filter(
                    (t) => !(target?.enabledTools.includes(t.name) ?? false),
                  );
                  if (missing.length === 0 || !target) return null;
                  const busy =
                    busyKey === `${target.serverIdHash}:*` ||
                    missing.some((t) => busyKey === `${target.serverIdHash}:${t.name}`);
                  return (
                    <button
                      disabled={busy}
                      onClick={() => {
                        onAddAll(
                          target.serverIdHash,
                          missing.map((t) => t.name),
                        );
                      }}
                      className="rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Adding…' : 'Add all'}
                    </button>
                  );
                })()}
              </div>
              <ul className="mt-2 space-y-2">
                {category.tools.map((t) => {
                  const added = target?.enabledTools.includes(t.name) ?? false;
                  const key = `${target?.serverIdHash}:${t.name}`;
                  return (
                    <li
                      key={t.name}
                      className="flex items-center gap-3 rounded-2xl border border-navy/10 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold">{t.name}</p>
                        <p className="truncate text-xs text-heroslate">{t.description}</p>
                      </div>
                      {added ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          Added ✓
                        </span>
                      ) : (
                        <button
                          disabled={!target || busyKey === key}
                          onClick={() => target && onAdd(target.serverIdHash, t.name)}
                          className="shrink-0 rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busyKey === key ? 'Adding…' : 'Add'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
