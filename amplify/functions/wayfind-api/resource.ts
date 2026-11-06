import { defineFunction } from "@aws-amplify/backend";

export const wayfindApiFunction = defineFunction({
  name: "wayfind-api",
  timeoutSeconds: 300,
  memoryMB: 1024,
});
