import { describe, expect, test } from "bun:test"
import { pluginDependencyVersion } from "../src/installation/version"

describe("pluginDependencyVersion", () => {
  test("returns npm-safe versions unchanged", () => {
    expect(pluginDependencyVersion("1.2.3")).toBe("1.2.3")
    expect(pluginDependencyVersion("0.0.0-main-202607050502")).toBe("0.0.0-main-202607050502")
    expect(pluginDependencyVersion("local")).toBe("local")
  })

  test("skips slash-containing versions that npm treats as github owner/repo", () => {
    // Branch-stamped preview builds like 0.0.0-agent/m4-… hang on git ls-remote
    // when npm-package-arg parses the version as a remote.
    expect(pluginDependencyVersion("0.0.0-agent/m4-verdict-opencode-runtime-202607080429")).toBeUndefined()
    expect(pluginDependencyVersion("agent/m4-feature")).toBeUndefined()
  })

  test("skips empty string versions", () => {
    expect(pluginDependencyVersion("")).toBeUndefined()
  })
}
)
