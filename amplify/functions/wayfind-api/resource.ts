import { defineFunction } from "@aws-amplify/backend";

export const wayfindApiFunction = defineFunction({
  name: "wayfind-api",
  timeoutSeconds: 300,
  memoryMB: 1024,
  environment: {
    // Public RPC endpoints (not secrets) — execute will pick by user scope.
    SOLANA_DEVNET_RPC: process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com",
    SOLANA_MAINNET_RPC: process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com",
  },
});
