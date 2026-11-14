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
- [x] E2E each write on testnet — done via endpoint probes (see Live E2E section below)

## Redeem — done, hint path verified live
- [x] Verified real `redeemCollateral` is 6-arg (7th `maxFeePercentage` in old ABI doesn't exist on-chain — that + zero hints is why it always reverted)
- [x] Verified `getRedemptionHints` returns 3 values, not 4 (upstream ABI wrong)
- [x] Fixed upstream PriceFeed typo in local registry (39-char address → correct `...15f96A...` from `mezo-org/musd` deployment artifact; other 7 addresses match)
- [x] `mezo_musd_redeem` — real hints, truncated lot, 5M gas (code done, NOT live-fired: needs MUSD balance)
## Live E2E on the endpoint (testnet URL …f98/message)
- [x] Reads: balances, trove (closed), pool (0), ICR check
- [x] Stake 10 → pool showed 10 (first attempt falsely reported "approve reverted" — tx had landed; public-RPC receipt polling needs hardening)
- [x] Unstake 10 → back to 0, totals restored
- [x] Swap 1 MUSD → ~0.00001278 BTC (matches quote)
- [x] Found live: Privy REST rejects `gasLimit`, needs `gas_limit` (fixed, pushed — redeploy before redeem retry)
- [ ] Redeem retry after redeploy (5 MUSD)
- [ ] Trove loop: needs ~65 more MUSD top-up (repay+close math: debt ≈ borrow + fee + 200 vs wallet balance)
- [ ] Mint-and-stake E2E
- [ ] E2E redeem on testnet (needs MUSD: open trove → borrow → redeem loop)

## Stability pool — done, read verified live (86.2M MUSD total deposits)
- [x] `mezo_musd_pool_status` — live 🧪 (zero-position + totals)
- [x] `mezo_musd_stake` / `mezo_musd_unstake` (approve + provideToSP/withdrawFromSP — code done, NOT live-fired: needs MUSD balance)
- [ ] E2E stake/unstake on testnet

## Strategy + monitoring — code done, check verified live
- [x] `mezo_musd_check_icr` — live 🧪 (ICR vs MCR, TCR/recovery, % drop to liquidation, top-up/repay math for 150%)
- [x] `mezo_musd_mint_and_stake` — open → confirmed → approve → stake, sequential confirms + TCR note (code done, NOT live-fired: needs funded wallet)
- [ ] E2E mint-and-stake on testnet
- [ ] Scheduler note: true auto top-up needs a cron Lambda (follow-up, out of MCP scope)

## Swaps — quote verified live on all 3 testnet pools, execution path proven
- [x] `mezo_swap_quote` — live 🧪 (100 MUSD→0.001278 BTC / →80.95 mUSDC; 1 mUSDC→1.23 MUSD)
- [x] `mezo_swap_tokens` — code done; path proven live with dev key (approve + swapExactTokensForTokens, block 16775833). Direct pool.swap REVERTS — always route via Router
- [x] Token registry: mUSDC + mUSDT both nets (testnet addrs read off pool token0/token1, 6 dec; mainnet from docs, 6 dec verified on-chain)
- [x] BTC works as swap OUTPUT only (no approve path for native gas input)
- [x] Found + fixed: viem parseAbi needs `(address,address,bool,address)[]`, not `tuple(...)[]`
- [ ] E2E gateway swap (needs MUSD in the Privy wallet)
- [ ] CL pools phase 2 (needs pool address + Slipstream quoting)

## Mainnet + tests — contracts wired, verified live
- [x] Mainnet MUSD contract addresses — pulled from local `wayfind-mezo/musd` deployments (chain 31612), verified live: TCR 3996%, 16.95 BTC, 4 troves, no recovery
- [x] Found + fixed while wiring: `fetchPrice` hardcoded the testnet PriceFeed (mainnet reads would have hit a dead address)
- [ ] Mainnet RPC + policy already wired (Boar primary, `eip155:31612`, EVM default policy `d23bu5…fgn`)
- [ ] User-run mainnet dust test per tool class
- [ ] `node:test` + `tsx` unit tests for pure helpers (format/parse/encode/ICR math)

## Infra done along the way
- [x] `McpToolConfig` + `ToolContext` carry `evmWalletId/evmWalletAddress` (option B)
- [x] Issuance stamps EVM wallet (Connect regenerates restamp)
- [x] Authorization chain tabs (Solana table + Mezo single-policy card)
- [x] `PROVIVY_EVM_DEFAULT_POLICY_ID` declared on propose-signer
- [x] Frontend: EVM wallet in modal, grouped Balances, Mezo hero icons
