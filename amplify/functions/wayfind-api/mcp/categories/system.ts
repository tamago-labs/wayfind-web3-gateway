import type { ToolDef } from "../types";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const twoNumbers = {
  type: "object",
  properties: {
    a: { type: "number", description: "First operand" },
    b: { type: "number", description: "Second operand" },
  },
  required: ["a", "b"],
  additionalProperties: false,
} as const;

const binary =
  (
    op: (a: number, b: number) => number,
    symbol: string,
  ): ToolDef["run"] =>
  (args) => {
    const a = num(args.a);
    const b = num(args.b);
    if (a === null || b === null) {
      return { text: "Both 'a' and 'b' must be numbers.", isError: true };
    }
    return { text: `${a} ${symbol} ${b} = ${op(a, b)}` };
  };

// System tools are always on: they double as the connectivity smoke test
// (Inspector / mcp-remote should call ping first, then add).
export const systemTools: ToolDef[] = [
  {
    name: "ping",
    category: "system",
    description: "Connectivity check. Returns 'pong' with the server name.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: () => ({ text: "pong (wayfind-mcp)" }),
  },
  {
    name: "add",
    category: "system",
    description: "Add two numbers.",
    inputSchema: twoNumbers,
    run: binary((a, b) => a + b, "+"),
  },
  {
    name: "subtract",
    category: "system",
    description: "Subtract b from a.",
    inputSchema: twoNumbers,
    run: binary((a, b) => a - b, "-"),
  },
  {
    name: "multiply",
    category: "system",
    description: "Multiply two numbers.",
    inputSchema: twoNumbers,
    run: binary((a, b) => a * b, "×"),
  },
  {
    name: "divide",
    category: "system",
    description: "Divide a by b. Errors on division by zero.",
    inputSchema: twoNumbers,
    run: (args) => {
      const a = num(args.a);
      const b = num(args.b);
      if (a === null || b === null) {
        return { text: "Both 'a' and 'b' must be numbers.", isError: true };
      }
      if (b === 0) return { text: "Division by zero.", isError: true };
      return { text: `${a} ÷ ${b} = ${a / b}` };
    },
  },
];
