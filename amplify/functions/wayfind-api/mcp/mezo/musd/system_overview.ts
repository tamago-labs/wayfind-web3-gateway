import type { ToolDef } from "../../types";
import { fetchSystemOverview } from "../musd";

export const mezoMusdSystemOverviewTool: ToolDef = {
  name: "mezo_musd_system_overview",
  category: "mezo",
  description: "Read MUSD system health: TCR, total collateral/debt, trove count, recovery mode. Read-only.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  run: async (_args, ctx) => {
    try {
      const overview = await fetchSystemOverview(ctx.network);
      return { text: JSON.stringify(overview, null, 2) };
    } catch (e) {
      return { text: `Could not read system overview: ${e instanceof Error ? e.message : e}`, isError: true };
    }
  },
};
