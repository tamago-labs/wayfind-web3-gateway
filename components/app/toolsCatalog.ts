// Frontend mirror of the backend registry (mcp/registry.ts + categories).
// Names must match; the backend stays the source of truth for execution.
export interface CatalogTool {
  name: string;
  description: string;
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon: string;
  tools: CatalogTool[];
  comingSoon?: boolean;
}

export const CATALOG: CatalogCategory[] = [
  {
    id: 'wallet',
    label: 'Wallet Operations',
    icon: 'https://pbs.twimg.com/profile_images/2106330567872786432/hJXHNtGj_400x400.jpg',
    tools: [
      { name: 'get_balances', description: 'Read SOL plus every token balance, including stocks.' },
      { name: 'get_history', description: 'Read the latest transactions, newest first.' },
      { name: 'get_transaction', description: 'Look up one transaction by signature.' },
      { name: 'get_wallet_address', description: 'Show the attached wallet address and network.' },
      { name: 'send_tokens', description: 'Send SOL or SPL tokens by symbol. Policy-enforced.' },
    ],
  },
  {
    id: 'okx',
    label: 'OKX DEX Swaps',
    icon: 'https://bitpinas.com/wp-content/uploads/2025/05/OKX-Wallet.webp',
    tools: [
      { name: 'okx_get_quote', description: 'Read-only swap quote (Solana mainnet).' },
      { name: 'okx_swap_tokens', description: 'Swap via OKX DEX. Mainnet only, policy-enforced.' },
    ],
  },
  {
    id: 'usdc',
    label: 'Stablecoin Finance',
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKJOU1hlUwQHEaxxTrT0wu40kDcvhQKMr4w6ga1m8gaA&s=10',
    tools: [
      { name: 'usdc_unified_balance', description: 'Total USDC + per-chain breakdown. Read-only.' },
      { name: 'usdc_chains', description: 'Valid destination chains for the current network. Read-only.' },
      { name: 'usdc_deposit', description: 'Deposit USDC into unified balance. Policy-enforced.' },
      { name: 'usdc_spend', description: 'Spend USDC, optionally cross-chain. Policy-enforced.' },
    ],
  },
  {
    id: 'mezo',
    label: 'Mezo EVM',
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/39727.png',
    tools: [
      { name: 'mezo_get_wallet_address', description: 'Show the attached Mezo wallet and network.' },
      { name: 'mezo_get_balances', description: 'Read BTC, MEZO, and MUSD balances. Read-only.' },
      { name: 'mezo_get_transaction', description: 'Look up one Mezo transaction by hash. Read-only.' },
      { name: 'mezo_send_tokens', description: 'Send BTC, MEZO, or MUSD by symbol. Policy-enforced.' },
      { name: 'mezo_musd_trove_status', description: 'Read trove collateral, debt, ICR. Read-only.' },
      { name: 'mezo_musd_borrowing_fee', description: 'Quote the MUSD borrowing fee. Read-only.' },
      { name: 'mezo_musd_system_overview', description: 'TCR, totals, recovery mode. Read-only.' },
      { name: 'mezo_musd_interest_rate', description: 'Current borrow interest rate. Read-only.' },
      { name: 'mezo_musd_protocol_constants', description: 'CCR, MCR, redemption fee. Read-only.' },
      { name: 'mezo_musd_max_borrowing_capacity', description: 'How much more a trove can borrow. Read-only.' },
      { name: 'mezo_musd_open_trove', description: 'Open a trove: deposit BTC, borrow MUSD. Policy-enforced.' },
      { name: 'mezo_musd_add_collateral', description: 'Add BTC collateral to your trove. Policy-enforced.' },
      { name: 'mezo_musd_withdraw_collateral', description: 'Withdraw BTC collateral. Policy-enforced.' },
      { name: 'mezo_musd_repay', description: 'Repay MUSD debt (approves first if needed). Policy-enforced.' },
      { name: 'mezo_musd_close_trove', description: 'Close a debt-free trove. Policy-enforced.' },
      { name: 'mezo_musd_redeem', description: 'Redeem MUSD for BTC at the $1 peg. Policy-enforced.' },
      { name: 'mezo_musd_pool_status', description: 'Stability Pool position and gains. Read-only.' },
      { name: 'mezo_musd_stake', description: 'Stake MUSD to earn BTC gains. Policy-enforced.' },
      { name: 'mezo_musd_unstake', description: 'Withdraw staked MUSD. Policy-enforced.' },
      { name: 'mezo_musd_check_icr', description: 'Trove health, liquidation distance, top-up math. Read-only.' },
      { name: 'mezo_musd_mint_and_stake', description: 'Borrow MUSD and stake in one flow. Policy-enforced.' },
      { name: 'mezo_swap_quote', description: 'Quote MUSD/BTC/mUSDC/mUSDT swaps. Read-only.' },
      { name: 'mezo_swap_tokens', description: 'Swap via the pool router with slippage guard. Policy-enforced.' },
    ],
  },
];

const META = new Map<string, { categoryId: string; category: string; description: string }>();
for (const cat of CATALOG) {
  for (const t of cat.tools) {
    META.set(t.name, { categoryId: cat.id, category: cat.label, description: t.description });
  }
}

export function toolMeta(name: string): { categoryId: string; category: string; description: string } {
  return META.get(name) ?? { categoryId: '', category: 'Other', description: '' };
}
