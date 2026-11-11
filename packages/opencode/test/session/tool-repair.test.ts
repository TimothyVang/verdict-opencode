import { describe, expect, test } from "bun:test"
import { Permission } from "../../src/permission"
import {
  INTERNAL_REPAIR_TOOL,
  isInternalRepairTool,
  normalizeToolNameKey,
  repairFailedToolCall,
  repairToolName,
} from "../../src/session/llm/tool-repair"

describe("tool-repair", () => {
  const tools = {
    "findevil-agent-mcp_audit_append": {},
    "findevil-mcp_evtx_query": {},
    "findevil-mcp_case_open": {},
    invalid: {},
  }

  test("normalizeToolNameKey collapses separator drift", () => {
    expect(normalizeToolNameKey("findevil-agent_mcp_audit_append")).toBe(
      normalizeToolNameKey("findevil-agent-mcp_audit_append"),
    )
    expect(normalizeToolNameKey("findevil_mcp_evtx_query")).toBe(normalizeToolNameKey("findevil-mcp_evtx_query"))
  })

  test("repairToolName remaps underscore/hyphen MCP name drift", () => {
    // m23/m24 FORCE_AGENT residual: model used agent_mcp instead of agent-mcp
    expect(repairToolName("findevil-agent_mcp_audit_append", tools)).toBe("findevil-agent-mcp_audit_append")
    expect(repairToolName("findevil_mcp_evtx_query", tools)).toBe("findevil-mcp_evtx_query")
    expect(repairToolName("findevil-mcp_case_open", tools)).toBe("findevil-mcp_case_open")
  })

  test("repairToolName remaps case drift", () => {
    expect(repairToolName("FinDevil-MCP_evtx_query", tools)).toBe("findevil-mcp_evtx_query")
  })

  test("repairToolName returns undefined for unknown tools", () => {
    expect(repairToolName("totally_invented_tool", tools)).toBeUndefined()
    expect(repairToolName("invalid", tools)).toBeUndefined()
  })

  test("repairFailedToolCall remaps separator drift to a real tool", () => {
    const result = repairFailedToolCall({
      toolCall: {
        toolCallId: "call_1",
        toolName: "findevil-agent_mcp_audit_append",
        input: JSON.stringify({ path: "/tmp/audit.jsonl" }),
      },
      tools,
      errorMessage: "Model tried to call unavailable tool 'findevil-agent_mcp_audit_append'",
    })
    expect(result).toMatchObject({
      toolCallId: "call_1",
      toolName: "findevil-agent-mcp_audit_append",
      input: JSON.stringify({ path: "/tmp/audit.jsonl" }),
    })
  })

  test("repairFailedToolCall routes unknown names to invalid sink with available-tool hint", () => {
    const result = repairFailedToolCall({
      toolCall: {
        toolCallId: "call_2",
        toolName: "not_a_real_tool",
        input: "{}",
      },
      tools,
      errorMessage: "Model tried to call unavailable tool 'not_a_real_tool'",
    })
    expect(result?.toolName).toBe(INTERNAL_REPAIR_TOOL)
    const payload = JSON.parse(result!.input) as { tool: string; error: string }
    expect(payload.tool).toBe("not_a_real_tool")
    expect(payload.error).toContain("findevil-agent-mcp_audit_append")
    expect(payload.error).not.toContain("invalid")
  })

  test("repairFailedToolCall returns null when invalid sink missing (deny-all residual)", () => {
    const noSink = {
      "findevil-mcp_evtx_query": {},
    }
    expect(
      repairFailedToolCall({
        toolCall: { toolCallId: "call_3", toolName: "bogus", input: "{}" },
        tools: noSink,
        errorMessage: "missing",
      }),
    ).toBeNull()
  })

  test("isInternalRepairTool only matches invalid", () => {
    expect(isInternalRepairTool("invalid")).toBe(true)
    expect(isInternalRepairTool("findevil-mcp_evtx_query")).toBe(false)
  })
})

describe("DFIR deny-all keeps invalid repair sink", () => {
  test("Permission.disabled marks invalid under * deny, but allow-list keeps findevil tools", () => {
    const ruleset = Permission.fromConfig({
      "*": "deny",
      "findevil-mcp_*": "allow",
      "findevil-agent-mcp_*": "allow",
    })
    const disabled = Permission.disabled(
      ["invalid", "bash", "findevil-mcp_evtx_query", "findevil-agent-mcp_audit_append"],
      ruleset,
    )
    // Without the resolveTools special-case, invalid would be stripped — this is the gap #15 left open.
    expect(disabled.has("invalid")).toBe(true)
    expect(disabled.has("bash")).toBe(true)
    expect(disabled.has("findevil-mcp_evtx_query")).toBe(false)
    expect(disabled.has("findevil-agent-mcp_audit_append")).toBe(false)
  })
})
