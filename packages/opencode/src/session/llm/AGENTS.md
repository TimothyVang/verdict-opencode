# Session LLM Runtime Boundaries

`../llm.ts` is the opencode session LLM service. It owns opencode concerns: auth, config, model/provider resolution, plugins, permissions, telemetry headers, and runtime selection. It is the only file in this area that should know about the full session request shape.

This folder contains adapters behind that service boundary:

- `ai-sdk.ts` converts AI SDK `fullStream` parts into `@opencode-ai/llm` `LLMEvent`s. This is the default runtime path.
- `native-request.ts` converts opencode's normalized session input into a native `@opencode-ai/llm` `LLMRequest`. It does not execute requests.
- `native-runtime.ts` is the opt-in native runtime adapter. It decides whether a selected model is supported, builds the native request, bridges opencode tools into native executable tools, and delegates transport to `LLMClient` / `RequestExecutor`.

## File Structure

```txt
src/session/
  llm.ts                    session-owned orchestration and runtime selection
  llm/
    AGENTS.md               boundary notes for the adapter layer
    ai-sdk.ts               AI SDK fullStream -> @opencode-ai/llm LLMEvent adapter
    native-request.ts       opencode/AI SDK-shaped input -> @opencode-ai/llm LLMRequest
    native-runtime.ts       native runtime gate, tool bridge, and LLMClient handoff
```

Integration points:

- `../llm.ts` imports `LLMClient` from `@opencode-ai/llm/route`; native execution is the only path that calls it directly.
- `../llm.ts` imports `LLMAISDK` from `./llm/ai-sdk`; the AI SDK path still calls `streamText(...)` locally, then adapts `result.fullStream` into shared `LLMEvent`s.
- `../llm.ts` imports `LLMNativeRuntime` from `./llm/native-runtime`; this is the runtime-selection seam. Unsupported native requests return a reason and fall back to AI SDK.
- `native-runtime.ts` imports `LLMNative` from `./native-request`; this keeps request lowering separate from transport and tool execution.
- `native-request.ts` is the only adapter file that should construct `LLM.request(...)`, `LLM.model(...)`, `Message.*`, `SystemPart`, `ToolCallPart`, `ToolResultPart`, or `ToolDefinition` values from `@opencode-ai/llm`.
- `ai-sdk.ts` and `native-runtime.ts` both emit `@opencode-ai/llm` `LLMEvent`s so downstream session processing does not care which runtime handled the request.

Keep new integration code on one of these seams. Avoid importing session services into `native-request.ts`; pass normalized data through `RequestInput` instead.

## Runtime selection

Both runtimes converge on the same `LLMEvent` stream consumed by the session processor. The gate is per-request: a single session can route some calls through native and fall back for others.

```txt
                             ╭───────────────────╮
╭───────────────────────────▶│ session processor │
│                            ╰─────────┬─────────╯
│                                      │
│                                      │
│                                      │
│                                      ▼
│                         ╭─────────────────────────╮
│                         │ LLM.Service (../llm.ts) │
│                         ╰────────────┬────────────╯
│                                      │
│                                      │
│                                      │
│                                      ▼
│                                ╭───────────╮
│                              ╭─╯           ╰─╮
│                              │  native gate  │
│                              ╰─╮           ╭─╯
│                                ╰─────┬─────╯
│                                      │
│                     ╭────── no ──────┴─────── yes ────────╮
│                     │                                     │
│                     ▼                                     ▼
│       ╭───────────────────────────╮             ╭───────────────────╮
│       │          AI SDK           │             │ native-runtime.ts │
│       │ streamText / generateText │             ╰────────┬──────────╯
│       ╰─────────────┬─────────────╯                      │
│                     │                                    │
│                 ╭───╯                                    │
│                 │                                        │
│                 ▼                                        ▼
│     ╭───────────────────────╮             ╭────────────────────────────╮
│     │       ai-sdk.ts       │             │     native-request.ts      │
│     │ fullStream → LLMEvent │             │ session input → LLMRequest │
│     ╰──────────┬────────────╯             ╰──────────────┬─────────────╯
│                │                                         │
│                │                                     ╭───╯
│                │                                     │
│                ▼                                     ▼
│       ╭─────────────────╮             ╭─────────────────────────────╮
╰───────┤ LLMEvent stream │◀────────────┤ LLMClient · RequestExecutor │
        ╰─────────────────╯             ╰─────────────────────────────╯
```

`native-runtime.ts` evaluates the gate and either bridges into `@opencode-ai/llm` or returns control so `llm.ts` can take the AI SDK path. Tool execution stays opencode-owned in both branches; only request lowering and transport differ.

Safety boundary:

- AI SDK remains the default.
- `OPENCODE_EXPERIMENTAL_NATIVE_LLM=true` or the umbrella `OPENCODE_EXPERIMENTAL=true` opts in. Native is not a global replacement.
- The native gate is npm-package based and must stay aligned with what `native-request.ts` can lower. API-key paths currently supported:

  | Catalog npm | Native facade / route | Notes |
  |---|---|---|
  | `@ai-sdk/openai` | OpenAI Responses | OpenAI OAuth + plugin `fetch` override also native |
  | `@ai-sdk/anthropic` | Anthropic Messages | API key |
  | `@ai-sdk/google` | Gemini | API key |
  | `@ai-sdk/azure` | Azure OpenAI Responses | Requires base URL (resource endpoint) |
  | `@ai-sdk/amazon-bedrock` | Bedrock Converse | API key bearer path only (no SigV4 wiring here) |
  | `@openrouter/ai-sdk-provider` | OpenRouter | API key |
  | `@ai-sdk/openai-compatible` | OpenAI-compatible Chat | Requires base URL (e.g. Ollama `http://host:11434/v1`) |
  | `@ai-sdk/xai` | XAI Responses | API key only |

- Explicit AI SDK fallback (fail-closed):
  - Missing API key
  - Missing base URL for openai-compatible or Azure
  - Unsupported npm package
  - OAuth without an OpenAI plugin `fetch` override
  - **xAI OAuth** always — plugin fetch refresh/bearer injection is the AI-SDK contract; do not force native OAuth for xAI even when `options.fetch` is present
