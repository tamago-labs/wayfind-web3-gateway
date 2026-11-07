import { defineFunction, secret } from "@aws-amplify/backend";

export const walletStateFunction = defineFunction({
  name: "wallet-state",
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? "",
    PRIVY_APP_SECRET: secret("PRIVY_APP_SECRET"),
  },
});
