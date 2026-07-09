/**
 * Repair weak-model tool names so SessionPrompt can recover instead of looping.
 *
 * Local models (e.g. gpt-oss) invent underscore/hyphen variants such as
 * `findevil-agent_mcp_audit_append` when the registry has
 * `findevil-agent-mcp_audit_append`. AI SDK's experimental_repairToolCall
 * only helps when we remap to a real tool or to the internal `invalid` sink.
 */

/** Internal repair sink — must stay executable, never advertised via activeTools. */
export const INTERNAL_REPAIR_TOOL = "invalid"

export function isInternalRepairTool(name: string) {
  return name === INTERNAL_REPAIR_TOOL
}

/** Collapse `-` / `_` runs so separator drift still matches registry names. */
export function normalizeToolNameKey(name: string) {
  return name.toLowerCase().replace(/[-_]+/g, "_")
}

/**
 * Map a model-emitted tool name onto an existing tools map entry.
 * Returns undefined when no recoverable match exists (caller may use invalid sink).
 */
export function repairToolName(requested: string, tools: Record<string, unknown>): string | undefined {
  if (Object.prototype.hasOwnProperty.call(tools, requested) && !isInternalRepairTool(requested)) {
    return requested
  }

  const lower = requested.toLowerCase()
  if (lower !== requested && Object.prototype.hasOwnProperty.call(tools, lower) && !isInternalRepairTool(lower)) {
    return lower
  }

  const target = normalizeToolNameKey(requested)
  for (const name of Object.keys(tools)) {
    if (isInternalRepairTool(name)) continue
    if (normalizeToolNameKey(name) === target) return name
  }
  return undefined
}

/**
 * Build the experimental_repairToolCall result for a failed tool invocation.
 * Prefers remapping to a real tool; otherwise routes to the internal invalid sink
 * with an available-tool hint when that sink is present.
 */
export function repairFailedToolCall<T extends { toolName: string; input: string }>(input: {
  readonly toolCall: T
  readonly tools: Record<string, unknown>
  readonly errorMessage: string
}): T | null {
  const repaired = repairToolName(input.toolCall.toolName, input.tools)
  if (repaired) {
    return {
      ...input.toolCall,
      toolName: repaired,
    }
  }

  if (!Object.prototype.hasOwnProperty.call(input.tools, INTERNAL_REPAIR_TOOL)) {
    // DFIR deny-all profiles used to strip `invalid`; without the sink, return null
    // so AI SDK rethrows the original NoSuchToolError (not a second 'invalid' miss).
    return null
  }

  const available = Object.keys(input.tools)
    .filter((name) => !isInternalRepairTool(name))
    .slice(0, 48)
  const hint =
    available.length > 0 ? ` Available tools (${available.length}): ${available.join(", ")}` : ""

  return {
    ...input.toolCall,
    input: JSON.stringify({
      tool: input.toolCall.toolName,
      error: `${input.errorMessage}.${hint}`,
    }),
    toolName: INTERNAL_REPAIR_TOOL,
  }
}
