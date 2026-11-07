import type { ToolDef } from "../../types";

export const pingTool: ToolDef = {
  name: "ping",
  category: "system",
  description: "Connectivity check. Returns 'pong' with the server name.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: () => ({ text: "pong (wayfind-mcp)" }),
};
