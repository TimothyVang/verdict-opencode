import { afterEach, describe, expect, test } from "bun:test"
import { chmod, copyFile, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const shimPath = path.resolve(import.meta.dir, "../../bin/opencode")
const tempDirs: string[] = []

async function makeFakeRuntime(dir: string) {
  const file = path.join(dir, "runtime")
  await writeFile(
    file,
    [
      "#!/usr/bin/env node",
      "console.log(JSON.stringify({ displayName: process.env.OPENCODE_CLI_NAME, argv: process.argv.slice(2) }))",
    ].join("\n"),
  )
  await chmod(file, 0o755)
  return file
}

async function runShim(name: string, env: Record<string, string> = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "verdict-bin-shim-"))
  tempDirs.push(dir)

  const fakeRuntime = await makeFakeRuntime(dir)
  const shimCopy = path.join(dir, "opencode")
  const invokedPath = path.join(dir, name)
  await copyFile(shimPath, shimCopy)
  await chmod(shimCopy, 0o755)
  await symlink(shimCopy, invokedPath)

  const proc = Bun.spawn([invokedPath, "run", "--help"], {
    env: { ...process.env, ...env, OPENCODE_BIN_PATH: fakeRuntime },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  expect(stderr).toBe("")
  expect(exitCode).toBe(0)
  return JSON.parse(stdout) as { displayName: string; argv: string[] }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("package binary shim", () => {
  const unixTest = process.platform === "win32" ? test.skip : test

  unixTest("passes verdict invocation name through to the runtime", async () => {
    const result = await runShim("verdict")

    expect(result.displayName).toBe("verdict")
    expect(result.argv).toEqual(["run", "--help"])
  })

  unixTest("does not overwrite an explicit display-name override", async () => {
    const result = await runShim("verdict", { OPENCODE_CLI_NAME: "custom" })

    expect(result.displayName).toBe("custom")
  })
})
