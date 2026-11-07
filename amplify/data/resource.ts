import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { proposeSignerFunction } from "../functions/propose-signer/resource";
import { walletStateFunction } from "../functions/wallet-state/resource";
import { revokeSignerFunction } from "../functions/revoke-signer/resource";

const schema = a.schema({
  UserProfile: a
    .model({
      email: a.string().required(),
      displayName: a.string(),
      region: a.string(),
      plan: a.enum(["free", "starter", "premium", "enterprise"]),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  proposeSigner: a
    .mutation()
    .arguments({ walletAddress: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(proposeSignerFunction)),

  walletState: a
    .query()
    .arguments({ walletId: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(walletStateFunction)),

  revokeSigner: a
    .mutation()
    .arguments({ walletId: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(revokeSignerFunction)),
}).authorization((allow) => [
  allow.resource(proposeSignerFunction),
  allow.resource(walletStateFunction),
  allow.resource(revokeSignerFunction),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
  },
});
