import type { ToolDef } from "../../types";
import { fetchProtocolConstants } from "../musd";

export const mezoMusdProtocolConstantsTool: ToolDef = {
  name: "mezo_musd_protocol_constants",
  category: "mezo",
  description: "Read MUSD protocol constants: CCR, MCR, redemption fee, borrow rate. Read-only.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: async (_args, ctx) => {
    try {
      const constants = await fetchProtocolConstants(ctx.network);
      return { text: JSON.stringify(constants, null, 2) };
    } catch (e) {
      return { text: `Could not read protocol constants: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
