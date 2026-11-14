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
type McpRecord = {
  walletId: string;
  walletAddress?: string | null;
  network?: "mainnet" | "testnet" | null;
  evmWalletId?: string | null;
  evmWalletAddress?: string | null;
  enabledTools?: (string | null)[] | null;
} | null;

export async function resolveContext(serverId: string): Promise<ToolContext | null> {
  if (process.env.MCP_SEED_SERVER_ID && serverId === process.env.MCP_SEED_SERVER_ID) {
    return { serverId, walletId: "seed", walletAddress: null, network: "testnet", evmWalletId: null, evmWalletAddress: null, enabledTools: null };
  }
  let record: McpRecord = null;
  try {
    const res = await dataClient.models.McpToolConfig.get({
      serverIdHash: hashServerId(serverId),
    });
    record = res.data;
  } catch (e) {
    console.error("[mcp] McpToolConfig lookup failed:", e instanceof Error ? e.message : e);
    return null;
  }
  if (!record) return null;
  return {
    serverId,
    walletId: record.walletId,
    walletAddress: record.walletAddress ?? null,
    network: record.network === "mainnet" ? "mainnet" : "testnet",
    evmWalletId: record.evmWalletId ?? null,
    evmWalletAddress: record.evmWalletAddress ?? null,
    enabledTools: (record.enabledTools ?? []).filter((t): t is string => typeof t === "string"),
  };
}
