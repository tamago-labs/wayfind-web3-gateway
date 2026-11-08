import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { handleMcp } from "./mcp/server";
import { getSwapInstruction, getSwapQuote } from "./mcp/lib/okx";

const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Long-running entry point. History reads live on Solana RPC (Logs page);
// delegation reads live on Privy (wallet-state). Until the gateway ships,
// execution stays blocked here.
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, body: "" };
  }
  // MCP routes live under /mcp/{serverId}[/message] (Streamable HTTP).
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (rawPath === "/mcp" || rawPath.startsWith("/mcp/")) {
    const res = await handleMcp({
      method: event.requestContext.http.method,
      path: rawPath,
      body: event.body,
    });
    return {
      statusCode: res.statusCode,
      headers: { "Content-Type": "application/json" },
      body: typeof res.body === "string" ? res.body : JSON.stringify(res.body),
    };
  }
  // OKX DEX routes (parity with the retired wayfin backend).
  if (event.requestContext.http.method === "GET" && rawPath.endsWith("/swap-quote")) {
    const qs = event.queryStringParameters ?? {};
    try {
      const data = await getSwapQuote({
        fromTokenAddress: qs.fromTokenAddress,
        toTokenAddress: qs.toTokenAddress,
        fromSymbol: qs.fromSymbol,
        toSymbol: qs.toSymbol,
        amount: qs.amount ?? "",
      });
      return json(200, { data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap quote failed";
      const status = msg.startsWith("Missing required parameters") ? 400 : 502;
      return json(status, { error: msg });
    }
  }
  if (event.requestContext.http.method === "GET" && rawPath.endsWith("/swap-instruction")) {
    const qs = event.queryStringParameters ?? {};
    try {
      const data = await getSwapInstruction({
        fromTokenAddress: qs.fromTokenAddress,
        toTokenAddress: qs.toTokenAddress,
        fromSymbol: qs.fromSymbol,
        toSymbol: qs.toSymbol,
        amount: qs.amount ?? "",
        userWalletAddress: qs.userWalletAddress ?? "",
        slippagePercent: qs.slippagePercent,
        autoSlippage: qs.autoSlippage,
        feePercent: qs.feePercent,
        swapReceiverAddress: qs.swapReceiverAddress,
        denySplitRoute: qs.denySplitRoute,
      });
      return json(200, { data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap instruction failed";
      const status = msg.startsWith("Missing required parameters") ? 400 : 502;
      return json(status, { error: msg });
    }
  }

  let action = "health";
  try {
    if (event.body) action = (JSON.parse(event.body) as { action?: string }).action ?? "health";
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  if (action === "health") {
    return json(200, { ok: true, service: "wayfind-api", status: "ok" });
  }

  if (action === "execute") {
    return json(200, { ok: true, status: "blocked", reason: "gateway execution is not live yet" });
  }

  return json(400, { ok: false, error: `Unknown action: ${action}` });
};
