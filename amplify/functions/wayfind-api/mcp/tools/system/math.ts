import type { ToolDef } from "../../types";

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

const binary = (op: (a: number, b: number) => number, symbol: string): ToolDef["run"] => (args) => {
  const a = num(args.a);
  const b = num(args.b);
  if (a === null || b === null) {
    return { text: "Both 'a' and 'b' must be numbers.", isError: true };
  }
  return { text: `${a} ${symbol} ${b} = ${op(a, b)}` };
};

const def = (
  name: string,
  description: string,
  run: ToolDef["run"],
): ToolDef => ({ name, category: "system", description, inputSchema: twoNumbers, run });

export const addTool = def("add", "Add two numbers.", binary((a, b) => a + b, "+"));
export const subtractTool = def("subtract", "Subtract b from a.", binary((a, b) => a - b, "-"));
export const multiplyTool = def("multiply", "Multiply two numbers.", binary((a, b) => a * b, "×"));
export const divideTool: ToolDef = {
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
};
