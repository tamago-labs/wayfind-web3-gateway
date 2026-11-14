# Mezo migration checklist (gateway `wayfind-api` ← `wayfind-mezo/mcp`)

Legend: ✅ tested live on testnet · 🧪 tested locally via tsx · ⬜ pending · 🚫 blocked

## Base wallet tools (4) — DONE, live ✅
- [x] `mezo_get_wallet_address` — live ✅
- [x] `mezo_get_balances` (BTC + MEZO + MUSD) — live ✅
- [x] `mezo_get_transaction` — live ✅ (receipt-lag → pending fix committed)
- [x] `mezo_send_tokens` — live ✅ (0.0001 BTC testnet confirmed, block 16774891)

## MUSD reads (6) — code done, deployed, verify on endpoint
- [x] `mezo_musd_trove_status` — local 🧪 (empty-trove ICR `N/A` fix committed)
- [x] `mezo_musd_borrowing_fee` — local 🧪 (1.8 on 1800 = 0.10%)
- [x] `mezo_musd_system_overview` — local 🧪 (TCR 240%, 327 troves)
- [x] `mezo_musd_interest_rate` — local 🧪 (1.00%)
- [x] `mezo_musd_protocol_constants` — local 🧪 (CCR 150 / MCR 110 / redeem 0.75%)
- [x] `mezo_musd_max_borrowing_capacity` — local 🧪
- [ ] Verify all six via `tools/call` on the deployed endpoint

## Trove writes (5) — code done, NOT live-tested yet
- [ ] `mezo_musd_open_trove` — double-fee fix (borrows raw amount, contract adds fee + 200 deposit once), min 1800, ICR≥MCR pre-check, fee cap
- [ ] `mezo_musd_add_collateral`
- [ ] `mezo_musd_withdraw_collateral`
- [ ] `mezo_musd_repay` (auto-approve + waits for approve receipt)
- [ ] `mezo_musd_close_trove` (refuses with repay-first hint if debt > 0)
- [ ] E2E each write on testnet (needs EVM signer authorized + testnet BTC)

## Redeem — done, hint path verified live
- [x] Verified real `redeemCollateral` is 6-arg (7th `maxFeePercentage` in old ABI doesn't exist on-chain — that + zero hints is why it always reverted)
- [x] Verified `getRedemptionHints` returns 3 values, not 4 (upstream ABI wrong)
- [x] Fixed upstream PriceFeed typo in local registry (39-char address → correct `...15f96A...` from `mezo-org/musd` deployment artifact; other 7 addresses match)
- [x] `mezo_musd_redeem` — real hints, truncated lot, 5M gas (code done, NOT live-fired: needs MUSD balance)
- [ ] E2E redeem on testnet (needs MUSD: open trove → borrow → redeem loop)

## Stability pool — done, read verified live (86.2M MUSD total deposits)
- [x] `mezo_musd_pool_status` — live 🧪 (zero-position + totals)
- [x] `mezo_musd_stake` / `mezo_musd_unstake` (approve + provideToSP/withdrawFromSP — code done, NOT live-fired: needs MUSD balance)
- [ ] E2E stake/unstake on testnet

## Strategy + monitoring — pending
- [ ] `mezo_musd_check_icr` (ICR vs MCR/CCR, distance-to-liquidation)
- [ ] Mint-and-stake strategy (open trove → stake MUSD, pre-checks, sequential confirms)
- [ ] Scheduler note: true auto top-up needs a cron Lambda (follow-up, out of MCP scope)

## Mainnet + tests — pending
- [ ] 🚫 Mainnet MUSD contract addresses (upstream `mainnet: {}` empty — pull from `mezo-org/musd` / explorer)
- [ ] Mainnet RPC + policy already wired (Boar primary, `eip155:31612`, EVM default policy `d23bu5…fgn`)
- [ ] User-run mainnet dust test per tool class
- [ ] `node:test` + `tsx` unit tests for pure helpers (format/parse/encode/ICR math)

## Infra done along the way
- [x] `McpToolConfig` + `ToolContext` carry `evmWalletId/evmWalletAddress` (option B)
- [x] Issuance stamps EVM wallet (Connect regenerates restamp)
- [x] Authorization chain tabs (Solana table + Mezo single-policy card)
- [x] `PROVIVY_EVM_DEFAULT_POLICY_ID` declared on propose-signer
- [x] Frontend: EVM wallet in modal, grouped Balances, Mezo hero icons
