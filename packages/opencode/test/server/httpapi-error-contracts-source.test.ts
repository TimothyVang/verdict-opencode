import { readdirSync, readFileSync } from "fs"
import path from "path"
import { describe, expect, test } from "bun:test"

/**
 * Structural regression lock for HttpApi error contracts (PRs #6–#8).
 * Every HttpApiEndpoint.* block in groups/ should declare an `error:` field.
 * Heuristic: split on HttpApiEndpoint. and require "error:" before the next endpoint.
 */
describe("HttpApi group source error contracts", () => {
  test("every HttpApiEndpoint in groups/ declares error:", () => {
    const dir = path.join(import.meta.dir, "../../src/server/routes/instance/httpapi/groups")
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "metadata.ts" && f !== "query.ts")
    const missing: string[] = []

    for (const file of files) {
      const text = readFileSync(path.join(dir, file), "utf8")
      // Skip pure re-export or empty groups
      if (!text.includes("HttpApiEndpoint.")) continue
      const parts = text.split(/HttpApiEndpoint\.(get|post|put|delete|patch)\s*\(/)
      // parts[0] is preamble; then alternating method, body...
      for (let i = 1; i < parts.length; i += 2) {
        const method = parts[i]
        const body = parts[i + 1] ?? ""
        // endpoint body ends at next top-level annotateMerge closing roughly — take until "}).annotateMerge" or next 800 chars
        const chunk = body.slice(0, 1200)
        if (!/\berror\s*:/.test(chunk)) {
          const nameMatch = chunk.match(/["'`]([a-zA-Z0-9._/-]+)["'`]/)
          const name = nameMatch?.[1] ?? `idx${i}`
          missing.push(`${file}:${method}:${name}`)
        }
      }
    }

    expect(missing).toEqual([])
  })
})
