import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

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
