import { createHash } from "node:crypto";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/wayfind-api";
import type { Schema } from "../../../data/resource";
import type { ToolContext } from "./types";

// Lambda has no amplify_outputs.json — endpoint and IAM credentials come from
// the function's own runtime env (wired by the schema-level allow.resource
// grant). Same pattern as wayfind-cloud's wayfind-api handler.
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env as any);
Amplify.configure(resourceConfig, libraryOptions);
const dataClient = generateClient<Schema>({ authMode: "iam" });

export const hashServerId = (serverId: string): string =>
  createHash("sha256").update(serverId).digest("hex");

// Phase 2 auth: serverId → SHA-256 → McpToolConfig lookup (IAM read).
// The MCP_SEED_SERVER_ID fallback exists for local smoke tests only — it is
// never set on deployed environments, so production is DB-only.
export async function resolveContext(serverId: string): Promise<ToolContext | null> {
  if (process.env.MCP_SEED_SERVER_ID && serverId === process.env.MCP_SEED_SERVER_ID) {
    return { serverId, walletId: "seed", enabledTools: null };
  }
  let record: { walletId: string; enabledTools: (string | null)[] | null | undefined } | null = null;
  try {
    const res = await dataClient.models.McpToolConfig.get({
      serverIdHash: hashServerId(serverId),
    });
    record = res.data;
  } catch {
    return null;
  }
  if (!record) return null;
  return {
    serverId,
    walletId: record.walletId,
    enabledTools: (record.enabledTools ?? []).filter((t): t is string => typeof t === "string"),
  };
}
