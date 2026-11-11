import { Effect, Schema } from "effect"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  tool: Schema.String,
  error: Schema.String,
})

export const InvalidTool = Tool.define(
  "invalid",
  Effect.succeed({
    description:
      "Internal repair only — models must never choose this tool. Use exact findevil-mcp_* / findevil-agent-mcp_* names.",
    parameters: Parameters,
    execute: (params: { tool: string; error: string }) =>
      Effect.succeed({
        title: "Invalid Tool",
        // Used for both unknown tool names (via experimental_repairToolCall) and
        // schema failures — tell the model to retry with an exact advertised name.
        output: `Tool call rejected for "${params.tool}": ${params.error}. Use an exact available tool name with valid arguments; do not invent tool names.`,
        metadata: {},
      }),
  }),
)
