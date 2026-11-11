import { afterEach, describe, expect, test } from "bun:test"
import { Context, Effect } from "effect"
import path from "path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { FilePaths } from "../../src/server/routes/instance/httpapi/groups/file"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { pollWithTimeout } from "../lib/effect"

const context = Context.empty() as Context.Context<unknown>

type QueryParams = Record<string, string | readonly string[]>

function request(route: string, directory: string, query?: QueryParams) {
  const url = new URL(`http://localhost${route}`)
  Object.entries(query ?? {}).forEach(([key, value]) =>
    (Array.isArray(value) ? value : [value]).forEach((item) => url.searchParams.append(key, item)),
  )
  return HttpApiApp.webHandler().handler(
    new Request(url, {
      headers: {
        "x-opencode-directory": directory,
      },
    }),
    context,
  )
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("file HttpApi", () => {
  test("serves read endpoints", async () => {
    await using tmp = await tmpdir({ git: true })
    await Bun.write(path.join(tmp.path, "hello.txt"), "hello")

    const [list, content, status] = await Promise.all([
      request(FilePaths.list, tmp.path, { path: "." }),
      request(FilePaths.content, tmp.path, { path: "hello.txt" }),
      request(FilePaths.status, tmp.path),
    ])

    expect(list.status).toBe(200)
    expect(await list.json()).toContainEqual(
      expect.objectContaining({ name: "hello.txt", path: "hello.txt", type: "file" }),
    )

    expect(content.status).toBe(200)
    expect(await content.json()).toMatchObject({ type: "text", content: "hello" })

    expect(status.status).toBe(200)
    expect(await status.json()).toEqual([])
  })

  test("serves search endpoints", async () => {
    await using tmp = await tmpdir({ git: true })
    await Bun.write(path.join(tmp.path, "hello.txt"), "needle")

    const [text, symbols] = await Promise.all([
      request(FilePaths.findText, tmp.path, { pattern: "needle" }),
      request(FilePaths.findSymbol, tmp.path, { query: "hello" }),
    ])
    const files = await Effect.runPromise(
      pollWithTimeout(
        Effect.promise(async () => {
          const response = await request(FilePaths.findFile, tmp.path, { query: "hello", type: "file" })
          const body = await response.json()
          return body.includes("hello.txt") ? { response, body } : undefined
        }),
        "file search index was not ready",
      ),
    )

    expect(text.status).toBe(200)
    expect(await text.json()).toContainEqual(expect.objectContaining({ line_number: 1 }))

    expect(files.response.status).toBe(200)
    expect(files.body).toContain("hello.txt")

    expect(symbols.status).toBe(200)
    expect(await symbols.json()).toEqual([])
  })

  test("returns bad request for invalid route queries", async () => {
    await using tmp = await tmpdir({ git: true })

    const cases: Array<{ route: string; query?: QueryParams }> = [
      { route: FilePaths.findText },
      { route: FilePaths.findFile },
      { route: FilePaths.findSymbol },
      { route: FilePaths.list },
      { route: FilePaths.content },
      { route: FilePaths.status, query: { directory: [tmp.path, tmp.path] } },
    ]
    const responses = await Promise.all(cases.map((item) => request(item.route, tmp.path, item.query)))

    await Promise.all(
      responses.map(async (response, index) => {
        expect(response.status, cases[index]!.route).toBe(400)
        expect(await response.json()).toMatchObject({ name: "BadRequest" })
      }),
    )
  })

  test("rejects file content paths outside the routed directory", async () => {
    await using tmp = await tmpdir({ git: true })

    const response = await request(FilePaths.content, tmp.path, { path: "../outside.txt" })

    expect(response.status).toBe(400)
  })
})
