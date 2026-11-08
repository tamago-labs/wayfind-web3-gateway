'use client';

import { useState } from 'react';
import { maskUrl, mcpJsonSnippet } from './McpAccessCard';

const PLACEHOLDER_URL = 'https://<your-wayfind-host>/mcp/****/message';

function CodeBlock({ code, onCopy, copied }: { code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-navy">
      <div className="flex items-center justify-end border-b border-white/10 px-3 py-1.5">
        <button
          onClick={onCopy}
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-white/90">
        {code}
      </pre>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-heroslate">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

export default function McpClientTabs({ url }: { url: string | null }) {
  const [tab, setTab] = useState<'wayfind' | 'claude' | 'vscode' | 'any'>('wayfind');
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Display stays masked (like Card 1); copying always writes the full URL.
  const displayUrl = url ? maskUrl(url) : PLACEHOLDER_URL;
  const displayJson = mcpJsonSnippet(displayUrl);
  const tabs = [
    { id: 'wayfind', label: 'Wayfind Cloud' },
    { id: 'claude', label: 'Claude' },
    { id: 'vscode', label: 'VS Code' },
    { id: 'any', label: 'Any Other MCP Client' },
  ] as const;

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-heroslate">
        MCP Clients
      </p>
      <p className="mt-2 text-lg font-bold">Popular AI agents that connect to your Wayfind MCP server</p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="MCP clients">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-navy text-white' : 'bg-navy/5 text-navy hover:bg-navy/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!url && (
        <p className="mt-3 rounded-2xl bg-bamber/20 p-3 text-sm text-navy">
          Generate a URL in the card above first — the guides below will fill in automatically.
        </p>
      )}

      <div className="mt-4">
        {tab === 'wayfind' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-heroslate">
                Give your Wayfind Cloud Bots on-chain access — connect this MCP server as a
                connector, then ask any Bot to use your wallet tools.
              </p>
              <p className="mt-3 text-sm font-bold text-navy">Setting up in Wayfind Cloud</p>
              <Steps
                items={[
                  'Open wayfind.click and sign in',
                  'Click Connectors in the bottom-left corner',
                  'Under the Web3 category, choose the Web3 connector',
                  'Paste the Integration URL on the right into the URL field',
                  'Save, then ask your Bot to check a balance to confirm it’s live',
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-navy">Integration URL (paste directly)</p>
              <CodeBlock code={displayUrl} onCopy={() => url && copy(url, 'wayfind-url')} copied={copied === 'wayfind-url'} />
            </div>
          </div>
        )}

        {tab === 'claude' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-heroslate">
                Link Claude with Wayfind MCP, letting it handle on-chain workflows through a secure
                setup — all within your conversation window.
              </p>
              <p className="mt-3 text-sm font-bold text-navy">Setting up in Claude</p>
              <p className="mt-1 text-xs text-heroslate">
                Note: only a Claude organization admin can complete these steps. Once connected, the
                integration is available to everyone in the org, but only you manage its tools.
              </p>
              <Steps
                items={[
                  'Navigate to claude.ai/settings/integrations',
                  'Click on Organization integrations',
                  'Select Add integration',
                  'Enter a name and paste the Integration URL on the right',
                  'Click Add',
                  'Open a new chat → Search and tools → pick the Wayfind MCP connection → select tools',
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-navy">Integration URL (paste directly)</p>
              <CodeBlock code={displayUrl} onCopy={() => url && copy(url, 'claude-url')} copied={copied === 'claude-url'} />
            </div>
          </div>
        )}

        {tab === 'vscode' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-heroslate">
                Add Wayfind MCP to VS Code&apos;s MCP support via <span className="font-mono">.vscode/mcp.json</span>.
              </p>
              <Steps
                items={[
                  'Create .vscode/mcp.json in your workspace (or open it if it exists)',
                  'Paste the JSON block on the right under mcpServers',
                  'Save — VS Code starts the server through mcp-remote automatically',
                  'Open the MCP view to confirm WayfindMCP is running, then use Agent mode',
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-navy">mcp.json snippet</p>
              <CodeBlock code={displayJson} onCopy={() => url && copy(mcpJsonSnippet(url), 'vscode-json')} copied={copied === 'vscode-json'} />
            </div>
          </div>
        )}

        {tab === 'any' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-navy">Works with any MCP-compatible client</p>
              <p className="mt-1 text-sm text-heroslate">
                If your AI agent, IDE, or automation tool supports the Model Context Protocol, paste
                the URL from above and you&apos;re done — no special setup beyond what your client requires.
              </p>
              <div className="mt-3 rounded-2xl border border-bamber/40 bg-bamber/15 p-3 text-sm text-navy">
                <span className="font-bold">Warning: </span>
                treat this URL like a password. It can trigger tools linked to your account and move
                funds. Don&apos;t paste it into public repos, shared docs, or anywhere others can read it.
              </div>
              <p className="mt-3 text-sm font-bold text-navy">Transport type</p>
              <p className="mt-1 text-sm text-heroslate">
                Wayfind MCP uses HTTP (Streamable HTTP) transport. Select this if your client asks
                you to choose: HTTP / Streamable HTTP.
              </p>
              <p className="mt-3 text-sm font-bold text-navy">General connection steps</p>
              <Steps
                items={[
                  'Open your client’s MCP or integrations settings',
                  'Add a new MCP server — look for Add server, New connection, or an mcp.json config file',
                  'Set transport to HTTP or Streamable HTTP',
                  'Paste the MCP URL from above into the server URL field',
                  'Save and enable Agent mode or equivalent in your client',
                ]}
              />
              <p className="mt-3 text-xs text-heroslate">
                Clients known to work include Claude, Cursor, VS Code, Zed, Continue, Cline, n8n, and
                others with Streamable HTTP support. Otherwise check your client&apos;s MCP documentation.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-navy">JSON config snippet</p>
              <p className="mb-2 text-xs text-heroslate">
                For clients that accept a JSON config file (common in IDE-based agents):
              </p>
              <CodeBlock code={displayJson} onCopy={() => url && copy(mcpJsonSnippet(url), 'any-json')} copied={copied === 'any-json'} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
