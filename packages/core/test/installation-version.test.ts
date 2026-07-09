import { describe, expect, test } from "bun:test"
import npa from "npm-package-arg"
import { pluginDependencyVersion } from "../src/installation/version"

describe("pluginDependencyVersion", () => {
  test("pins ordinary semver and preview versions", () => {
    expect(pluginDependencyVersion("1.2.3")).toBe("1.2.3")
    expect(pluginDependencyVersion("0.0.0-agent-m4-verdict-202607080429")).toBe(
      "0.0.0-agent-m4-verdict-202607080429",
    )
  })

  test("skips slash-containing versions that npm-package-arg treats as github remotes", () => {
    const bad = "0.0.0-agent/m4-verdict-opencode-runtime-202607080429"
    // Documents the hang class: npa rewrites the pin into github:user/project
    // and arborist then blocks on git ls-remote.
    const parsed = npa(`@opencode-ai/plugin@${bad}`)
    expect(parsed.type).toBe("git")
    expect(parsed.hosted?.user).toBe("0.0.0-agent")
    expect(parsed.hosted?.project).toBe("m4-verdict-opencode-runtime-202607080429")

    expect(pluginDependencyVersion(bad)).toBeUndefined()
    expect(pluginDependencyVersion("")).toBeUndefined()
  })

  test("sanitized branch-style versions stay npm version pins", () => {
    const good = "0.0.0-agent-m4-verdict-opencode-runtime-202607080429"
    const parsed = npa(`@opencode-ai/plugin@${good}`)
    expect(parsed.type).toBe("version")
    expect(pluginDependencyVersion(good)).toBe(good)
  })
})
