import { describe, expect, test } from "bun:test"
import { CliDisplay } from "../../src/cli/display"

describe("CLI display name", () => {
  test("uses the installed compiled executable path before bunfs argv", () => {
    const input = {
      argv: ["bun", "/$bunfs/root/opencode", "run", "--help"],
      execPath: "/home/user/.local/bin/verdict",
      env: {},
    }

    expect(CliDisplay.cliDisplayName(input)).toBe("verdict")
    expect(CliDisplay.cliProductName(input)).toBe("VERDICT")
  })

  test("falls back to opencode for source-mode execution", () => {
    const input = {
      argv: ["bun", "/repo/packages/opencode/src/index.ts", "--help"],
      execPath: "/home/user/.bun/bin/bun",
      env: {},
    }

    expect(CliDisplay.cliDisplayName(input)).toBe("opencode")
    expect(CliDisplay.cliProductName(input)).toBe("opencode")
  })

  test("supports explicit display-name overrides", () => {
    const input = {
      argv: ["bun", "/$bunfs/root/opencode"],
      execPath: "/home/user/.local/bin/opencode",
      env: { VERDICT_CLI_NAME: "verdict" },
    }

    expect(CliDisplay.cliDisplayName(input)).toBe("verdict")
  })

  test("keeps source-mode auth username help compatible", () => {
    expect(
      CliDisplay.authUsernameDescription({
        argv: ["bun", "/repo/packages/opencode/src/index.ts", "--help"],
        execPath: "/home/user/.bun/bin/bun",
        env: {},
      }),
    ).toBe("basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')")
  })

  test("avoids opencode default username wording for verdict help", () => {
    expect(
      CliDisplay.authUsernameDescription({
        argv: ["bun", "/$bunfs/root/opencode", "run", "--help"],
        execPath: "/home/user/.local/bin/verdict",
        env: {},
      }),
    ).toBe("basic auth username (defaults to OPENCODE_SERVER_USERNAME or built-in username)")
  })

  test("preserves source-mode provider help while branding verdict help", () => {
    expect(
      CliDisplay.providersDescription({
        argv: ["bun", "/repo/packages/opencode/src/index.ts", "--help"],
        execPath: "/home/user/.bun/bin/bun",
        env: {},
      }),
    ).toBe("manage AI providers and credentials")
    expect(
      CliDisplay.providersDescription({
        argv: ["bun", "/$bunfs/root/opencode", "auth", "--help"],
        execPath: "/home/user/.local/bin/verdict",
        env: {},
      }),
    ).toBe("manage VERDICT providers and credentials")
  })
})
