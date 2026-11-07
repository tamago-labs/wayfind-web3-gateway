import { defineFunction, secret } from "@aws-amplify/backend";

export const wayfindApiFunction = defineFunction({
  name: "wayfind-api",
  timeoutSeconds: 300,
  memoryMB: 1024,
  environment: {
    // Public RPC endpoints (not secrets) — execute will pick by user scope.
    SOLANA_DEVNET_RPC: process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com",
    SOLANA_MAINNET_RPC: process.env.SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com",
    // Privy signing for send_sol (devnet). Secrets are set in the Amplify
    // console, never stored here. Same auth key the privy-tests scripts use.
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? "",
    PRIVY_APP_SECRET: secret("PRIVY_APP_SECRET"),
    PRIVY_AUTH_PRIVATE_KEY: secret("PRIVY_AUTH_PRIVATE_KEY"),
  },
});
