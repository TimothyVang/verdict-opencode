import { expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Config } from "@/config/config"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import { MessageID, SessionID } from "@/session/schema"
import { SessionSummary } from "@/session/summary"
import { Snapshot } from "@/snapshot"
import { NotFoundError } from "@/storage/storage"
import { TestConfig } from "../fixture/config"
import { testEffect } from "../lib/effect"

const session = Layer.mock(Session.Service, {
  messages: (input) => Effect.fail(new NotFoundError({ message: `Session not found: ${input.sessionID}` })),
})
const snapshot = Layer.mock(Snapshot.Service, {})
const events = Layer.mock(EventV2Bridge.Service, {})

const it = testEffect(
  LayerNode.compile(LayerNode.group([SessionSummary.node]), [
    [Config.node, TestConfig.layer()],
    [EventV2Bridge.node, events],
    [Session.node, session],
    [Snapshot.node, snapshot],
  ]),
)

it.effect("diff preserves missing-session errors on the Effect error channel", () =>
  Effect.gen(function* () {
    const summary = yield* SessionSummary.Service
    const sessionID = SessionID.descending()
    const error = yield* Effect.flip(summary.diff({ sessionID, messageID: MessageID.ascending() }))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe(`Session not found: ${sessionID}`)
  }),
)
