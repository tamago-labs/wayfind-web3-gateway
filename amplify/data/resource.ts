import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  UserProfile: a
    .model({
      email: a.string().required(),
      displayName: a.string(),
      region: a.string(),
      plan: a.enum(["free", "starter", "premium", "enterprise"]),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
  },
});
