import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { wayfindApiFunction } from "../functions/wayfind-api/resource";
import { proposeSignerFunction } from "../functions/propose-signer/resource";
import { walletStateFunction } from "../functions/wallet-state/resource";
import { revokeSignerFunction } from "../functions/revoke-signer/resource";

const schema = a.schema({
  UserProfile: a
    .model({
      ownerId: a.string(),
      email: a.string().required(),
      displayName: a.string(),
      region: a.string(),
      network: a.enum(["mainnet", "testnet"]),
      plan: a.enum(["free", "starter", "premium", "enterprise"]),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // One MCP server ID per wallet. The raw serverId is the credential (Zoho-style:
  // it lives only in the /mcp/<serverId>/message URL); only its SHA-256 is stored.
  // Client CRUD rides the same publicApiKey rule as UserProfile (unguessable hashes);
  // the wayfind-api Lambda reads via IAM for message auth.
  McpToolConfig: a
    .model({
      serverIdHash: a.string().required(),
      walletId: a.string().required(),
      enabledTools: a.string().array(),
    })
    .identifier(["serverIdHash"])
    .authorization((allow) => [allow.publicApiKey(), allow.resource(wayfindApiFunction)]),

  ProposeSignerResult: a.customType({
    walletAddress: a.string(),
    signerId: a.string(),
    signerName: a.string(),
    policyId: a.string(),
  }),

  WalletStateResult: a.customType({
    id: a.string(),
    address: a.string(),
    chainType: a.string(),
    delegated: a.boolean(),
    signerIds: a.string().array(),
    policyIds: a.string().array(),
  }),

  RevokeSignerResult: a.customType({
    walletId: a.string(),
    address: a.string(),
    revoked: a.boolean(),
  }),

  proposeSigner: a
    .mutation()
    .arguments({ walletAddress: a.string().required() })
    .returns(a.ref("ProposeSignerResult"))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(proposeSignerFunction)),

  walletState: a
    .query()
    .arguments({ walletId: a.string().required() })
    .returns(a.ref("WalletStateResult"))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(walletStateFunction)),

  revokeSigner: a
    .mutation()
    .arguments({ walletId: a.string().required() })
    .returns(a.ref("RevokeSignerResult"))
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(revokeSignerFunction)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
  },
});
