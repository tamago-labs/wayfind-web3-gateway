# Privy test kit

Black-box tests against Privy (REST API + Solana devnet) only — no Wayfind
backend involved. Mirrors the `wayfind-cloud/scripts/computer-tests/` pattern:
numbered steps, shared `config.ts`, structural PASS/FAIL. Stop on first FAIL
(each script exits non-zero). Run these **before** implementing the matching
backend/UI piece; each test pins the behavior our code must reproduce.

## Prerequisites

1. Privy Dashboard: authorization key created (save private key + key id),
   default policy created (save policy id).
2. Env:
   ```powershell
   $env:PRIVY_APP_ID="…"
   $env:PRIVY_APP_SECRET="…"
   $env:PRIVY_SIGNER_ID="…"
   $env:PRIVY_DEFAULT_POLICY_ID="…"
   ```
3. Run from the **repo root** so workspace paths resolve:
   ```powershell
   npx tsx scripts/privy-tests/01-privy-connection.ts
   ```

## Run order

| Step | What it proves | Gates |
|---|---|---|
| `01-privy-connection` | app credentials reach Privy (app-wide wallet list as probe) | everything |
| `02-test-wallet` | test wallet exists + funded (reuses `TEST_WALLET_ID`, prints it for reuse) | 04–06 |
| `03-policy-present` | default policy exists with rules | Authorization UI, `propose-signer` |
| `04-add-signer` | platform signer + policy attach to wallet | Authorization page flow |
| `05-send-sol-devnet` | 1000-lamport transfer signs + broadcasts, real tx hash | `wayfind-api execute` |
| `06-remove-signer` | signer detaches cleanly (rerunnable) | Revoke flow |

`04`/`06` are the server-side mirrors of Authorize/Revoke — the UI does the same
through `addSigners`/`removeSigners` with the user's signature instead of the
app secret. `TEST_WALLET_ID` must be an **app-owned** wallet (created by `02`
with no `TEST_WALLET_ID` set): a user-owned embedded wallet rejects server
PATCH with 401 and can only change through the UI flow. Optional env:
`TEST_WALLET_ID`, `TEST_SOL_DESTINATION` (default: self-transfer),
`SOLANA_DEVNET_RPC`.
