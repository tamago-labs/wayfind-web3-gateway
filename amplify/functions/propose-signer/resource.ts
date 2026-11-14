import { defineFunction, secret } from "@aws-amplify/backend";

export const proposeSignerFunction = defineFunction({
  name: "propose-signer",
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? "",
    PRIVY_APP_SECRET: secret("PRIVY_APP_SECRET"),
    PRIVY_SIGNER_NAME: process.env.PRIVY_SIGNER_NAME ?? "",
    PRIVY_SIGNER_ID: process.env.PRIVY_SIGNER_ID ?? "",
    PRIVY_DEFAULT_POLICY_ID: process.env.PRIVY_DEFAULT_POLICY_ID ?? "",
    PRIVY_SPENDING_CAPS_POLICY_ID: process.env.PRIVY_SPENDING_CAPS_POLICY_ID ?? "",
    PRIVY_TIGHT_POLICY_ID: process.env.PRIVY_TIGHT_POLICY_ID ?? "",
    PRIVY_EVM_DEFAULT_POLICY_ID: process.env.PRIVY_EVM_DEFAULT_POLICY_ID ?? "",
  },
});
