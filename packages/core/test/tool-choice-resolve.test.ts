import { describe, expect, test } from "bun:test"
import { resolveAgentToolChoice } from "../src/flag/tool-choice"

describe("resolveAgentToolChoice", () => {
  test("last step always forces none (max-steps early stop)", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      process.env["OPENCODE_TOOL_CHOICE"] = "required"
      delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      expect(resolveAgentToolChoice({ isLastStep: true })).toBe("none")
      expect(resolveAgentToolChoice({ isLastStep: true, structuredRequired: true })).toBe("none")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })

  test("structured output requires tool choice on non-final steps", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["OPENCODE_TOOL_CHOICE"]
      delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      expect(resolveAgentToolChoice({ isLastStep: false, structuredRequired: true })).toBe("required")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })

  test("OPENCODE_TOOL_CHOICE=required forces tool calls on non-final steps", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      process.env["OPENCODE_TOOL_CHOICE"] = "required"
      expect(resolveAgentToolChoice({ isLastStep: false })).toBe("required")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })

  test("VERDICT_FORCE_TOOL_CHOICE=1 maps to required on non-final steps", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["OPENCODE_TOOL_CHOICE"]
      process.env["VERDICT_FORCE_TOOL_CHOICE"] = "1"
      expect(resolveAgentToolChoice({ isLastStep: false })).toBe("required")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })

  test("default remains undefined (provider auto)", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["OPENCODE_TOOL_CHOICE"]
      delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      expect(resolveAgentToolChoice({ isLastStep: false })).toBeUndefined()
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })
})
