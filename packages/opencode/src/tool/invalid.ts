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
        output:
          `Tool call failed for '${params.tool}': ${params.error}. ` +
          `Retry with an exact available tool name (findevil-mcp_* or findevil-agent-mcp_* only). ` +
          `Do not call a tool named invalid.`,
        metadata: {},
      }),
  }),
)
