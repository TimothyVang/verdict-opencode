import { describe, expect, test } from "bun:test"
import { LLMEvent, ToolFailure } from "@opencode-ai/llm"
import { LLMClient, RequestExecutor, WebSocketExecutor, type LLMClientShape } from "@opencode-ai/llm/route"
import { jsonSchema, tool, type ModelMessage, type Tool } from "ai"
import { Effect, Fiber, Layer, Stream } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { LLMNative } from "@/session/llm/native-request"
import { LLMNativeRuntime } from "@/session/llm/native-runtime"
import type { Provider } from "@/provider/provider"

import { OAUTH_DUMMY_KEY } from "@/auth"
import { testEffect } from "../lib/effect"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"

const baseModel: Provider.Model = {
  id: ModelV2.ID.make("gpt-5-mini"),
  providerID: ProviderV2.ID.make("openai"),
  api: {
    id: "gpt-5-mini",
    url: "https://api.openai.com/v1",
    npm: "@ai-sdk/openai",
  },
  name: "GPT-5 Mini",
  capabilities: {
    temperature: true,
    reasoning: true,
    attachment: true,
    toolcall: true,
    input: {
      text: true,
      audio: false,
      image: true,
      video: false,
      pdf: false,
    },
    output: {
      text: true,
      audio: false,
      image: false,
      video: false,
      pdf: false,
    },
    interleaved: false,
  },
  cost: {
    input: 0,
    output: 0,
    cache: {
      read: 0,
      write: 0,
    },
  },
  limit: {
    context: 128_000,
    input: 128_000,
    output: 32_000,
  },
  status: "active",
  options: {},
  headers: {
    "x-model": "model-header",
  },
  release_date: "2026-01-01",
}

const providerInfo: Provider.Info = {
  id: ProviderV2.ID.make("openai"),
  name: "OpenAI",
  source: "config",
  env: ["OPENAI_API_KEY"],
  options: { apiKey: "test-openai-key" },
  models: {},
}

const it = testEffect(
  LLMClient.layer.pipe(
    Layer.provide(
      Layer.mergeAll(RequestExecutor.layer.pipe(Layer.provide(FetchHttpClient.layer)), WebSocketExecutor.layer),
    ),
  ),
)

function responsesStream(chunks: unknown[]) {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`).join("\n\n") + "\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  })
}

type NativeRequestInput = Parameters<typeof LLMNative.request>[0]

const sessionText = (text: string) => ({ type: "text" as const, text })

const sessionOpenAIReasoning = (
  text: string,
  options: {
    readonly storedAs: "providerMetadata" | "providerOptions"
    readonly itemId: string
    readonly encryptedContent: string | null
  },
) => {
  const metadata = {
    openai: { itemId: options.itemId, reasoningEncryptedContent: options.encryptedContent },
  }
  if (options.storedAs === "providerMetadata")
    return Object.assign({ type: "reasoning" as const, text }, { providerMetadata: metadata })
  return Object.assign({ type: "reasoning" as const, text }, { providerOptions: metadata })
}

type SessionAssistantPart = ReturnType<typeof sessionText> | ReturnType<typeof sessionOpenAIReasoning>

const storedSession = {
  user: (content: string): ModelMessage => ({ role: "user", content }),
  assistant: (content: SessionAssistantPart[]): ModelMessage => ({ role: "assistant", content }),
  text: sessionText,
  openaiReasoning: sessionOpenAIReasoning,
}

const openAIResponses = {
  user: (text: string) => ({ role: "user", content: [{ type: "input_text", text }] }),
  assistant: (text: string) => ({ role: "assistant", content: [{ type: "output_text", text }] }),
  openaiReasoning: (text: string, encryptedContent: string) => ({
    type: "reasoning",
    encrypted_content: encryptedContent,
    summary: [{ type: "summary_text", text }],
  }),
}

const prepareNativeRequest = (input: NativeRequestInput) => LLMClient.prepare(LLMNative.request(input))

const expectOpenAIResponsesRequest = (input: {
  readonly history: NativeRequestInput["messages"]
  readonly providerOptions?: NativeRequestInput["providerOptions"]
  readonly maxOutputTokens?: NativeRequestInput["maxOutputTokens"]
  readonly headers?: NativeRequestInput["headers"]
  readonly expectedBody: unknown
}) =>
  Effect.gen(function* () {
    expect(
      yield* prepareNativeRequest({
        model: baseModel,
        apiKey: "test-openai-key",
        messages: input.history,
        providerOptions: input.providerOptions,
        maxOutputTokens: input.maxOutputTokens,
        headers: input.headers,
      }),
    ).toMatchObject({
      route: "openai-responses",
      protocol: "openai-responses",
      body: input.expectedBody,
    })
  })

describe("session.llm-native.request", () => {
  test("maps normalized stream inputs to a native LLM request", () => {
    const messages: ModelMessage[] = [
      {
        role: "system",
        content: "system from messages",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "hello", providerOptions: { openai: { cacheControl: { type: "ephemeral" } } } },
          { type: "file", mediaType: "image/png", filename: "img.png", data: "data:image/png;base64,Zm9v" },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "thinking", providerOptions: { openai: { encryptedContent: "secret" } } },
          { type: "text", text: "I'll run it" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "bash",
            input: { command: "ls" },
            providerOptions: { openai: { itemId: "item-1" } },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "bash",
            output: { type: "text", value: "ok" },
            providerOptions: { openai: { outputId: "output-1" } },
          },
        ],
      },
    ]

    const request = LLMNative.request({
      model: baseModel,
      system: ["agent system"],
      messages,
      tools: {
        bash: tool({
          description: "Run a shell command",
          inputSchema: jsonSchema({
            type: "object",
            properties: {
              command: { type: "string" },
            },
            required: ["command"],
          }),
        }),
      },
      toolChoice: "required",
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
      providerOptions: { openai: { store: false } },
      headers: { "x-request": "request-header" },
    })

    expect(request.model).toMatchObject({
      id: "gpt-5-mini",
      provider: "openai",
      route: { id: "openai-responses" },
    })
    expect(request.model.route.endpoint.baseURL).toBe("https://api.openai.com/v1")
    expect(request.model.route.defaults.headers).toEqual({
      "x-model": "model-header",
      "x-request": "request-header",
    })
    expect(request.model.route.defaults.limits).toMatchObject({
      context: 128_000,
      output: 32_000,
    })
    expect(request.system).toEqual([
      { type: "text", text: "agent system" },
      { type: "text", text: "system from messages" },
    ])
    expect(request.generation).toMatchObject({
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxTokens: 1024,
    })
    expect(request.providerOptions).toEqual({ openai: { store: false } })
    expect(request.toolChoice).toMatchObject({ type: "required" })
    expect(request.tools).toMatchObject([
      {
        name: "bash",
        description: "Run a shell command",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string" },
          },
          required: ["command"],
        },
      },
    ])
    expect(request.messages).toMatchObject([
      {
        role: "user",
        content: [
          { type: "text", text: "hello", providerMetadata: { openai: { cacheControl: { type: "ephemeral" } } } },
          { type: "media", mediaType: "image/png", filename: "img.png", data: "data:image/png;base64,Zm9v" },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "thinking", providerMetadata: { openai: { encryptedContent: "secret" } } },
          { type: "text", text: "I'll run it" },
          {
            type: "tool-call",
            id: "call-1",
            name: "bash",
            input: { command: "ls" },
            providerMetadata: { openai: { itemId: "item-1" } },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            id: "call-1",
            name: "bash",
            result: { type: "text", value: "ok" },
            providerMetadata: { openai: { outputId: "output-1" } },
          },
        ],
      },
    ])
  })

  test("maps stored provider metadata to native content metadata", () => {
    const reasoning = Object.assign(
      { type: "reasoning" as const, text: "thinking" },
      {
        providerMetadata: {
          openai: {
            itemId: "rs_1",
            reasoningEncryptedContent: "encrypted-state",
          },
        },
      },
    )
    const request = LLMNative.request({
      model: baseModel,
      messages: [
        {
          role: "assistant",
          content: [reasoning],
        },
      ],
    })

    expect(request.messages).toMatchObject([
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: "thinking",
            providerMetadata: { openai: { itemId: "rs_1", reasoningEncryptedContent: "encrypted-state" } },
          },
        ],
      },
    ])
  })

  const catalogModel = (input: {
    readonly providerID: string
    readonly npm: string
    readonly url?: string
    readonly id?: string
  }): Provider.Model => ({
    ...baseModel,
    id: ModelV2.ID.make(input.id ?? baseModel.id),
    providerID: ProviderV2.ID.make(input.providerID),
    api: {
      id: input.id ?? baseModel.api.id,
      url: input.url ?? "",
      npm: input.npm,
    },
  })

  const catalogProvider = (input: {
    readonly id: string
    readonly apiKey?: string
    readonly baseURL?: string
    readonly fetch?: typeof globalThis.fetch
  }): Provider.Info => ({
    ...providerInfo,
    id: ProviderV2.ID.make(input.id),
    name: input.id,
    options: {
      ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
      ...(input.baseURL !== undefined ? { baseURL: input.baseURL } : {}),
      ...(input.fetch ? { fetch: input.fetch } : {}),
    },
  })

  test("selects native request routes for cloud and local provider packages", () => {
    const cases = [
      {
        name: "openai",
        model: catalogModel({ providerID: "openai", npm: "@ai-sdk/openai" }),
        route: "openai-responses",
        baseURL: "https://api.openai.com/v1",
      },
      {
        name: "anthropic",
        model: catalogModel({ providerID: "anthropic", npm: "@ai-sdk/anthropic" }),
        route: "anthropic-messages",
        baseURL: "https://api.anthropic.com/v1",
      },
      {
        name: "google",
        model: catalogModel({ providerID: "google", npm: "@ai-sdk/google" }),
        route: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
      },
      {
        name: "azure",
        model: catalogModel({
          providerID: "azure",
          npm: "@ai-sdk/azure",
          url: "https://example.openai.azure.com/openai/v1",
          id: "gpt-4o-deployment",
        }),
        route: "azure-openai-responses",
        baseURL: "https://example.openai.azure.com/openai/v1",
      },
      {
        name: "bedrock",
        model: catalogModel({
          providerID: "amazon-bedrock",
          npm: "@ai-sdk/amazon-bedrock",
          id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        }),
        route: "bedrock-converse",
        baseURL: "https://bedrock-runtime.us-east-1.amazonaws.com",
      },
      {
        name: "openrouter",
        model: catalogModel({ providerID: "openrouter", npm: "@openrouter/ai-sdk-provider" }),
        route: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
      },
      {
        name: "ollama-local",
        model: catalogModel({
          providerID: "ollama",
          npm: "@ai-sdk/openai-compatible",
          url: "http://127.0.0.1:11434/v1",
          id: "llama3.2",
        }),
        route: "openai-compatible-chat",
        baseURL: "http://127.0.0.1:11434/v1",
      },
      {
        name: "xai-api-key",
        model: catalogModel({ providerID: "xai", npm: "@ai-sdk/xai", id: "grok-3-mini" }),
        route: "openai-responses",
        baseURL: "https://api.x.ai/v1",
      },
    ] as const

    for (const item of cases) {
      const model = LLMNative.model({
        model: item.model,
        apiKey: "test-key",
        messages: [],
      })
      expect(model.route.id, item.name).toBe(item.route)
      expect(model.route.endpoint.baseURL, item.name).toBe(item.baseURL)
      // Route values are carried on the executable model, not recovered from a registry.
      expect(typeof model.route.protocol, item.name).toBe("string")
      expect(model.route.auth, item.name).toBeDefined()
      expect(String(model.provider), item.name).toBe(String(item.model.providerID))
    }
  })

  test("fails fast for unsupported provider packages and missing local base URLs", () => {
    expect(() =>
      LLMNative.request({
        model: { ...baseModel, api: { ...baseModel.api, npm: "unknown-provider" } },
        messages: [],
      }),
    ).toThrow("Native LLM request adapter does not support provider package unknown-provider")

    expect(() =>
      LLMNative.request({
        model: catalogModel({
          providerID: "ollama",
          npm: "@ai-sdk/openai-compatible",
          url: "",
          id: "llama3.2",
        }),
        apiKey: "ollama",
        messages: [],
      }),
    ).toThrow("Native LLM request adapter requires a base URL for ollama/llama3.2")

    expect(() =>
      LLMNative.request({
        model: catalogModel({
          providerID: "azure",
          npm: "@ai-sdk/azure",
          url: "",
          id: "gpt-4o-deployment",
        }),
        apiKey: "test-key",
        messages: [],
      }),
    ).toThrow("Native LLM request adapter requires a base URL for azure/gpt-4o-deployment")
  })

  test("native runtime gate matches request lowering for cloud and local API-key providers", () => {
    const supported = [
      {
        name: "openai",
        model: catalogModel({ providerID: "openai", npm: "@ai-sdk/openai", url: "https://api.openai.com/v1" }),
        provider: catalogProvider({ id: "openai", apiKey: "test-openai-key" }),
      },
      {
        name: "anthropic",
        model: catalogModel({
          providerID: "anthropic",
          npm: "@ai-sdk/anthropic",
          url: "https://api.anthropic.com/v1",
        }),
        provider: catalogProvider({ id: "anthropic", apiKey: "test-anthropic-key" }),
      },
      {
        name: "google",
        model: catalogModel({ providerID: "google", npm: "@ai-sdk/google" }),
        provider: catalogProvider({ id: "google", apiKey: "test-google-key" }),
      },
      {
        name: "azure",
        model: catalogModel({
          providerID: "azure",
          npm: "@ai-sdk/azure",
          url: "https://example.openai.azure.com/openai/v1",
        }),
        provider: catalogProvider({
          id: "azure",
          apiKey: "test-azure-key",
          baseURL: "https://example.openai.azure.com/openai/v1",
        }),
      },
      {
        name: "bedrock",
        model: catalogModel({ providerID: "amazon-bedrock", npm: "@ai-sdk/amazon-bedrock" }),
        provider: catalogProvider({ id: "amazon-bedrock", apiKey: "test-bedrock-key" }),
      },
      {
        name: "openrouter",
        model: catalogModel({ providerID: "openrouter", npm: "@openrouter/ai-sdk-provider" }),
        provider: catalogProvider({ id: "openrouter", apiKey: "test-openrouter-key" }),
      },
      {
        name: "ollama-local",
        model: catalogModel({
          providerID: "ollama",
          npm: "@ai-sdk/openai-compatible",
          url: "http://127.0.0.1:11434/v1",
          id: "llama3.2",
        }),
        provider: catalogProvider({
          id: "ollama",
          apiKey: "ollama",
          baseURL: "http://127.0.0.1:11434/v1",
        }),
      },
      {
        name: "opencode-compatible",
        model: catalogModel({
          providerID: "opencode",
          npm: "@ai-sdk/openai-compatible",
          url: "https://ai.example.test/v1",
        }),
        provider: catalogProvider({ id: "opencode", apiKey: "test-opencode-key" }),
      },
      {
        name: "xai-api-key",
        model: catalogModel({ providerID: "xai", npm: "@ai-sdk/xai", id: "grok-3-mini" }),
        provider: catalogProvider({ id: "xai", apiKey: "test-xai-key" }),
      },
    ] as const

    for (const item of supported) {
      expect(LLMNativeRuntime.status({ model: item.model, provider: item.provider, auth: undefined }), item.name).toMatchObject({
        type: "supported",
        apiKey: item.provider.options.apiKey,
      })
    }

    expect(
      LLMNativeRuntime.status({
        model: baseModel,
        provider: { ...providerInfo, options: {} },
        auth: undefined,
      }),
    ).toEqual({ type: "unsupported", reason: "API key is not configured", used_fallback: true })

    expect(
      LLMNativeRuntime.status({
        model: catalogModel({
          providerID: "ollama",
          npm: "@ai-sdk/openai-compatible",
          url: "",
          id: "llama3.2",
        }),
        provider: catalogProvider({ id: "ollama", apiKey: "ollama" }),
        auth: undefined,
      }),
    ).toEqual({ type: "unsupported", reason: "base URL is not configured", used_fallback: true })

    expect(
      LLMNativeRuntime.status({
        model: catalogModel({ providerID: "azure", npm: "@ai-sdk/azure", url: "" }),
        provider: catalogProvider({ id: "azure", apiKey: "test-azure-key" }),
        auth: undefined,
      }),
    ).toEqual({ type: "unsupported", reason: "base URL is not configured", used_fallback: true })

    expect(
      LLMNativeRuntime.status({
        model: catalogModel({ providerID: "custom", npm: "unknown-provider" }),
        provider: catalogProvider({ id: "custom", apiKey: "key" }),
        auth: undefined,
      }),
    ).toMatchObject({ type: "unsupported" })
  })

  test("run result records used_fallback false for native and true for AI SDK fallback", () => {
    // Source of truth for caseforge/downstream: native gate emits used_fallback so
    // callers never invent the value. Native path → false; AI SDK fallback → true.
    const native = LLMNativeRuntime.status({
      model: baseModel,
      provider: providerInfo,
      auth: undefined,
    })
    expect(native).toMatchObject({ type: "supported", used_fallback: false })
    expect(typeof (native as { used_fallback?: unknown }).used_fallback).toBe("boolean")

    const missingKey = LLMNativeRuntime.status({
      model: baseModel,
      provider: { ...providerInfo, options: {} },
      auth: undefined,
    })
    expect(missingKey).toEqual({
      type: "unsupported",
      reason: "API key is not configured",
      used_fallback: true,
    })

    const missingBaseURL = LLMNativeRuntime.status({
      model: catalogModel({
        providerID: "ollama",
        npm: "@ai-sdk/openai-compatible",
        url: "",
        id: "llama3.2",
      }),
      provider: catalogProvider({ id: "ollama", apiKey: "ollama" }),
      auth: undefined,
    })
    expect(missingBaseURL).toMatchObject({ type: "unsupported", used_fallback: true })

    const unknownPackage = LLMNativeRuntime.status({
      model: catalogModel({ providerID: "custom", npm: "unknown-provider" }),
      provider: catalogProvider({ id: "custom", apiKey: "key" }),
      auth: undefined,
    })
    expect(unknownPackage).toMatchObject({ type: "unsupported", used_fallback: true })

    // stream() must carry the same field on both supported and unsupported results.
    const client = {
      stream: () => Stream.empty,
    } as unknown as LLMClientShape
    const supportedStream = LLMNativeRuntime.stream({
      model: baseModel,
      provider: providerInfo,
      auth: undefined,
      llmClient: client,
      messages: [],
      tools: {},
      headers: {},
      abort: new AbortController().signal,
    })
    expect(supportedStream).toMatchObject({ type: "supported", used_fallback: false })

    const fallbackStream = LLMNativeRuntime.stream({
      model: baseModel,
      provider: { ...providerInfo, options: {} },
      auth: undefined,
      llmClient: client,
      messages: [],
      tools: {},
      headers: {},
      abort: new AbortController().signal,
    })
    expect(fallbackStream).toMatchObject({
      type: "unsupported",
      reason: "API key is not configured",
      used_fallback: true,
    })
  })

  test("falls back for OAuth and custom-fetch providers that are AI-SDK contracts", () => {
    expect(
      LLMNativeRuntime.status({
        model: baseModel,
        provider: providerInfo,
        auth: { type: "oauth", refresh: "refresh", access: "access", expires: 1 },
      }),
    ).toEqual({
      type: "unsupported",
      reason: "OAuth auth requires a provider fetch override",
      used_fallback: true,
    })

    // OpenAI OAuth with the codex plugin fetch override can stay on the native path.
    const dummyFetch = Object.assign(async () => new Response(), {
      preconnect: () => {},
    }) as typeof globalThis.fetch

    expect(
      LLMNativeRuntime.status({
        model: baseModel,
        provider: { ...providerInfo, options: { apiKey: OAUTH_DUMMY_KEY, fetch: dummyFetch } },
        auth: { type: "oauth", refresh: "refresh", access: "access", expires: 1 },
      }),
    ).toMatchObject({ type: "supported", apiKey: OAUTH_DUMMY_KEY, used_fallback: false })

    // xAI OAuth intentionally stays on AI SDK: plugin fetch owns refresh + bearer injection.
    expect(
      LLMNativeRuntime.status({
        model: catalogModel({ providerID: "xai", npm: "@ai-sdk/xai", id: "grok-3-mini" }),
        provider: catalogProvider({
          id: "xai",
          apiKey: OAUTH_DUMMY_KEY,
          fetch: dummyFetch,
        }),
        auth: { type: "oauth", refresh: "refresh", access: "access", expires: 1 },
      }),
    ).toEqual({
      type: "unsupported",
      reason: "xAI OAuth uses AI SDK plugin fetch override",
      used_fallback: true,
    })
  })

  test("enables native runtime for Anthropic API-key models", () => {
    expect(
      LLMNativeRuntime.status({
        model: {
          ...baseModel,
          providerID: ProviderV2.ID.make("anthropic"),
          api: { ...baseModel.api, npm: "@ai-sdk/anthropic", url: "https://api.anthropic.com/v1" },
        },
        provider: {
          ...providerInfo,
          id: ProviderV2.ID.make("anthropic"),
          name: "Anthropic",
          env: ["ANTHROPIC_API_KEY"],
          options: { apiKey: "test-anthropic-key" },
        },
        auth: undefined,
      }),
    ).toMatchObject({ type: "supported", apiKey: "test-anthropic-key" })
  })

  test("prefers console provider api key over stored opencode auth", () => {
    expect(
      LLMNativeRuntime.status({
        model: { ...baseModel, providerID: ProviderV2.ID.make("opencode") },
        provider: {
          ...providerInfo,
          id: ProviderV2.ID.make("opencode"),
          options: { apiKey: "console-token" },
          key: "zen-token",
        },
        auth: { type: "api", key: "zen-token" },
      }),
    ).toMatchObject({
      type: "supported",
      apiKey: "console-token",
    })
    expect(
      LLMNativeRuntime.status({
        model: baseModel,
        provider: { ...providerInfo, options: {}, key: "provider-key" },
        auth: undefined,
      }),
    ).toMatchObject({
      type: "supported",
      apiKey: "provider-key",
    })
  })

  it.effect("native tool wrapper converts thrown errors into typed ToolFailure", () =>
    Effect.gen(function* () {
      const wrapped = LLMNativeRuntime.nativeTools(
        {
          explode: {
            description: "always throws",
            inputSchema: jsonSchema({ type: "object" }),
            execute: async () => {
              throw new Error("boom")
            },
          } satisfies Tool,
        },
        { messages: [] as ModelMessage[], abort: new AbortController().signal },
      )

      const failure = yield* Effect.flip(wrapped.explode.execute({}, { id: "call-1", name: "explode" }))
      expect(failure).toBeInstanceOf(ToolFailure)
      expect(failure.message).toBe("boom")
    }),
  )

  it.effect("native tool wrapper raises ToolFailure when the source tool has no execute handler", () =>
    Effect.gen(function* () {
      // The AI SDK Tool shape allows execute to be omitted (e.g., client-side / MCP tools).
      // The native runtime owns execution, so encountering such a tool here means upstream
      // wiring is wrong; we want a typed failure, not a silent skip or unhandled exception.
      const wrapped = LLMNativeRuntime.nativeTools(
        { incomplete: { description: "no execute", inputSchema: jsonSchema({ type: "object" }) } satisfies Tool },
        { messages: [] as ModelMessage[], abort: new AbortController().signal },
      )

      const failure = yield* Effect.flip(wrapped.incomplete.execute({}, { id: "call-1", name: "incomplete" }))
      expect(failure).toBeInstanceOf(ToolFailure)
      expect(failure.message).toContain("incomplete")
    }),
  )

  it.effect("emits native tool calls before overlapping local settlements complete", () =>
    Effect.gen(function* () {
      const observed: string[] = []
      const started: string[] = []
      let release: (() => void) | undefined
      let notifyStarted: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const bothStarted = new Promise<void>((resolve) => {
        notifyStarted = resolve
      })
      const lookup = {
        description: "Lookup data",
        inputSchema: jsonSchema({ type: "object" }),
        execute: async (_args: unknown, options: { toolCallId: string }) => {
          started.push(options.toolCallId)
          if (started.length === 2) notifyStarted?.()
          await gate
          return { output: options.toolCallId }
        },
      } satisfies Tool
      const llmClient = {
        prepare: () => Effect.die("unused"),
        stream: () =>
          Stream.fromIterable([
            LLMEvent.toolCall({ id: "call-1", name: "lookup", input: {} }),
            LLMEvent.toolCall({ id: "call-2", name: "lookup", input: {} }),
            LLMEvent.finish({ reason: "tool-calls" }),
          ]),
        generate: () => Effect.die("unused"),
      } as LLMClientShape
      const native = LLMNativeRuntime.stream({
        model: baseModel,
        provider: providerInfo,
        auth: undefined,
        llmClient,
        messages: [],
        tools: { lookup },
        headers: {},
        abort: new AbortController().signal,
      })
      expect(native.type).toBe("supported")
      if (native.type === "unsupported") throw new Error(native.reason)

      const fiber = yield* native.stream.pipe(
        Stream.runForEach((event) => Effect.sync(() => observed.push(event.type))),
        Effect.forkScoped,
      )
      yield* Effect.promise(() => bothStarted)

      expect(started).toEqual(["call-1", "call-2"])
      expect(observed).toEqual(["tool-call", "tool-call", "finish"])

      release?.()
      yield* Fiber.join(fiber)
      expect(observed).toEqual(["tool-call", "tool-call", "finish", "tool-result", "tool-result"])
    }),
  )

  it.effect("compiles through the native OpenAI Responses route", () =>
    expectOpenAIResponsesRequest({
      history: [storedSession.user("hello")],
      providerOptions: { openai: { store: false, instructions: "You are concise." } },
      maxOutputTokens: 512,
      headers: { "x-request": "request-header" },
      expectedBody: {
        model: "gpt-5-mini",
        instructions: "You are concise.",
        input: [openAIResponses.user("hello")],
        max_output_tokens: 512,
        store: false,
        stream: true,
      },
    }),
  )

  it.effect("omits non-persisted OpenAI reasoning ids without encrypted state", () =>
    expectOpenAIResponsesRequest({
      history: [
        storedSession.user("What changed?"),
        storedSession.assistant([
          storedSession.openaiReasoning("Checked the previous diff.", {
            storedAs: "providerOptions",
            itemId: "rs_1",
            encryptedContent: null,
          }),
          storedSession.text("The parser changed."),
        ]),
        storedSession.user("Summarize it."),
      ],
      providerOptions: { openai: { store: false } },
      expectedBody: {
        input: [
          openAIResponses.user("What changed?"),
          openAIResponses.assistant("The parser changed."),
          openAIResponses.user("Summarize it."),
        ],
        store: false,
      },
    }),
  )

  it.effect("preserves encrypted OpenAI reasoning state through native request lowering", () =>
    expectOpenAIResponsesRequest({
      history: [
        storedSession.user("What changed?"),
        storedSession.assistant([
          storedSession.openaiReasoning("Checked the previous diff.", {
            storedAs: "providerMetadata",
            itemId: "rs_1",
            encryptedContent: "encrypted-state",
          }),
          storedSession.text("The parser changed."),
        ]),
        storedSession.user("Summarize it."),
      ],
      providerOptions: { openai: { store: false, include: ["reasoning.encrypted_content"] } },
      expectedBody: {
        input: [
          openAIResponses.user("What changed?"),
          openAIResponses.openaiReasoning("Checked the previous diff.", "encrypted-state"),
          openAIResponses.assistant("The parser changed."),
          openAIResponses.user("Summarize it."),
        ],
        include: ["reasoning.encrypted_content"],
        store: false,
      },
    }),
  )

  it.effect("preserves empty encrypted OpenAI reasoning items before tool output", () =>
    expectOpenAIResponsesRequest({
      history: [
        storedSession.assistant([
          storedSession.openaiReasoning("", {
            storedAs: "providerMetadata",
            itemId: "rs_1",
            encryptedContent: "encrypted-state",
          }),
        ]),
      ],
      providerOptions: { openai: { store: false, include: ["reasoning.encrypted_content"] } },
      expectedBody: {
        input: [{ type: "reasoning", summary: [], encrypted_content: "encrypted-state" }],
        include: ["reasoning.encrypted_content"],
        store: false,
      },
    }),
  )

  it.effect("references stored OpenAI reasoning items by id", () =>
    expectOpenAIResponsesRequest({
      history: [
        storedSession.assistant([
          storedSession.openaiReasoning("Checked the previous diff.", {
            storedAs: "providerMetadata",
            itemId: "rs_1",
            encryptedContent: null,
          }),
        ]),
      ],
      providerOptions: { openai: { store: true } },
      expectedBody: {
        input: [{ type: "item_reference", id: "rs_1" }],
        store: true,
      },
    }),
  )

  it.effect("uses provider fetch override for native OpenAI OAuth requests", () =>
    Effect.gen(function* () {
      const captures: Array<{ url: string; body: unknown }> = []
      const customFetch = Object.assign(
        async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
          const request = input instanceof Request ? input : new Request(input, init)
          captures.push({ url: request.url, body: await request.clone().json() })
          return responsesStream([
            { type: "response.output_text.delta", item_id: "msg_1", delta: "Hello" },
            { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
          ])
        },
        { preconnect: () => undefined },
      ) satisfies typeof fetch

      const llmClient = yield* LLMClient.Service
      const native = LLMNativeRuntime.stream({
        model: baseModel,
        provider: { ...providerInfo, options: { apiKey: OAUTH_DUMMY_KEY, fetch: customFetch } },
        auth: { type: "oauth", refresh: "refresh", access: "access", expires: Date.now() + 60_000 },
        llmClient,
        messages: [{ role: "user", content: "hello" }],
        tools: {},
        providerOptions: { instructions: "You are concise." },
        headers: {},
        abort: new AbortController().signal,
      })
      expect(native.type).toBe("supported")
      if (native.type === "unsupported") throw new Error(native.reason)
      const events = Array.from(yield* native.stream.pipe(Stream.runCollect))

      expect(captures).toHaveLength(1)
      expect(captures[0]).toMatchObject({
        url: "https://api.openai.com/v1/responses",
        body: {
          model: "gpt-5-mini",
          instructions: "You are concise.",
          input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }],
        },
      })
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text-delta", text: "Hello" }),
          expect.objectContaining({ type: "finish" }),
        ]),
      )
    }),
  )
})
