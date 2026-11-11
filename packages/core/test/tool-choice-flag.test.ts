import { describe, expect, test } from "bun:test"

describe("OPENCODE_TOOL_CHOICE / VERDICT_FORCE_TOOL_CHOICE", () => {
  test("reads required from OPENCODE_TOOL_CHOICE", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      process.env["OPENCODE_TOOL_CHOICE"] = "required"
      // Re-import would cache Flag getters — getters read process.env at access time.
      const { Flag } = await import("../src/flag/flag")
      expect(Flag.OPENCODE_TOOL_CHOICE).toBe("required")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })

  test("VERDICT_FORCE_TOOL_CHOICE=1 maps to required", async () => {
    const prev = process.env["OPENCODE_TOOL_CHOICE"]
    const prevForce = process.env["VERDICT_FORCE_TOOL_CHOICE"]
    try {
      delete process.env["OPENCODE_TOOL_CHOICE"]
      process.env["VERDICT_FORCE_TOOL_CHOICE"] = "1"
      const { Flag } = await import("../src/flag/flag")
      expect(Flag.OPENCODE_TOOL_CHOICE).toBe("required")
    } finally {
      if (prev === undefined) delete process.env["OPENCODE_TOOL_CHOICE"]
      else process.env["OPENCODE_TOOL_CHOICE"] = prev
      if (prevForce === undefined) delete process.env["VERDICT_FORCE_TOOL_CHOICE"]
      else process.env["VERDICT_FORCE_TOOL_CHOICE"] = prevForce
    }
  })
})
