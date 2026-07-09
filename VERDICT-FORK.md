# VERDICT — a branded fork of opencode

This repository is a **hard fork of [opencode](https://github.com/sst/opencode)**,
rebranded for the [VERDICT](https://github.com/TimothyVang/verdict-dfir) DFIR
toolkit. It tracks upstream and layers VERDICT branding on top of the opencode
application and TUI.


<p align="center"><img src=".verdict/tui-verdict.png" alt="VERDICT TUI" width="720"></p>
<p align="center"><sub>The rebranded TUI — true window screenshot of the source build (VER lilac / DICT cream).</sub></p>

## Upstream

- Forked from: `sst/opencode`
- At commit: `f52424e05fab0edddb4462112ceb02044085f903`
- Upstream license: MIT (preserved unchanged in [`LICENSE`](LICENSE), © the opencode authors)

opencode is excellent software; this fork exists only to present it under the
VERDICT brand, not to compete with or misrepresent it. All engine functionality
is upstream's work.

## What this fork changes

Cosmetic / branding only — no behavioral changes to the agent engine:

| Area | File | Change |
|---|---|---|
| TUI wordmark | `packages/tui/src/logo.ts` | "opencode" block-art logo → **VERDICT** (two-tone: VER lilac / DICT cream) |
| Terminal title | `packages/tui/src/app.tsx` | window/terminal title `OpenCode` and `OC \| …` → `VERDICT` / `VERDICT \| …` |
| App-name strings | `packages/tui/src/{routes/session/permission,attention,feature-plugins/home/tips-view}`, `packages/opencode/src/{cli/cmd/run/*,cli/cmd/uninstall,acp/service,mcp/oauth-provider,plugin/*}` | user-facing self-references "OpenCode" → "VERDICT" (permission dialogs, splash, uninstall, ACP labels, MCP OAuth client name, exit/update messages) |
| Auto-update off | `packages/opencode/src/cli/upgrade.ts` | update check hard-disabled — a fork must never pull upstream opencode releases (would overwrite the branded binary) |
| Agent persona | `packages/opencode/src/session/prompt/*.txt` | system prompts "You are OpenCode …" → "You are VERDICT …" (a behavioral change: the agent now identifies as VERDICT) |
| Remaining self-references | HTTP-API doc strings, `/init` template, ACP/MCP labels, TUI tips | standalone "OpenCode" → "VERDICT" (word-boundary sweep, `git log` for exact diff) |
| Theme | `packages/tui` (via user theme) | pairs with the VERDICT opencode theme (`verdict-agent-harness/.opencode/themes/verdict.json`) |

Intentionally **left intact** because they are functional, not branding:
code identifiers (`OpenCodeHttpApi`, `OpenCodeAssistantMessage`), the
`opencode serve` / `opencode.json` commands & config keys, the `@opencode-ai/*`
package names and `opencode.ai` URLs, real upstream service names ("opencode
Zen", "opencode Go"), and the provider billing header
(`X-BILLING-INVOKE-ORIGIN: OpenCode` in `provider/provider.ts`, which identifies
the client to providers' billing APIs).

<p align="center"><img src=".verdict/tui-verdict-binary.png" alt="Compiled VERDICT binary" width="720"></p>
<p align="center"><sub>The compiled standalone <code>verdict</code> binary — VERDICT wordmark + titlebar, no auto-update dialog.</sub></p>

## Local LLM / Ollama OpenAI-compat

caseforge drives this runtime with a custom `@ai-sdk/openai-compatible` provider
whose `options.baseURL` is `VERDICT_LLM_BASEURL`. The SDK POSTs
`${baseURL}/chat/completions`.

| `VERDICT_LLM_BASEURL` | Request path | Typical Ollama response |
|---|---|---|
| `http://host:11434/v1` | `/v1/chat/completions` | OpenAI-shaped JSON (success or `model … not found`) |
| `http://host:11434` (no `/v1`) | `/chat/completions` | plain `404 page not found` |

This fork does **not** rewrite bare Ollama roots — missing `/v1` is a caller
config issue (normalize in caseforge / env). Residual checks:

```bash
bash scripts/check-httpapi-error-contracts.sh   # always offline
# optional live probe (SKIP when host unset/down):
VERDICT_LLM_BASEURL=http://host:11434/v1 bash scripts/check-ollama-openai-compat.sh
```

## Build & run

Same as upstream (Bun ≥ 1.3.14, no Go needed):

```bash
bun install
# run from source:
bun run --cwd packages/opencode --conditions=browser src/index.ts [project]

# compile a standalone binary for the current platform:
cd packages/opencode && bun run script/build.ts --single --skip-embed-web-ui
# -> dist/opencode-<os>-<arch>/bin/opencode  (rename to `verdict`)
```

## Re-syncing with upstream

All branding is applied by one **idempotent** script,
[`scripts/verdict-rebrand.sh`](scripts/verdict-rebrand.sh) (`bun run
verdict:rebrand`), from canonical assets in [`.verdict/assets/`](.verdict/assets).
So a re-sync never merges branding by hand — it pulls upstream's tree and re-runs
the script.

opencode's default branch is **`dev`** (not `main`). Because this fork is a
snapshot (no shared history with upstream), treat upstream as a content source
rather than a merge base:

```bash
git remote add upstream https://github.com/sst/opencode.git   # once
git fetch upstream dev

# bring upstream's files into the working tree, then re-apply branding
git checkout upstream/dev -- .
bun install
bun run verdict:rebrand            # idempotent; re-brands logo/title/strings/persona

# review, verify, commit
git --no-pager diff --stat
bun run --cwd packages/opencode typecheck && bun run --cwd packages/tui typecheck
git add -A && git commit -m "sync: upstream dev $(git rev-parse --short upstream/dev) + rebrand"

# rebuild the binary
cd packages/opencode && bun run script/build.ts --single --skip-embed-web-ui
```

**Always review `git diff` after a sync.** The word-boundary sweep is safe for
code identifiers, but an upstream update could introduce a *new* functional
"OpenCode" string (e.g. an HTTP header) that the sweep would wrongly flip — add
it to the preserved list / exclusions in the script if so. The
`verdict-branding` CI workflow checks the branding stays present, idempotent, and
type-clean on every push.

> Verified: pulling pristine `upstream/dev` files and running the script
> re-derives the full branding (logo → VERDICT, title → VERDICT, persona
> → "You are VERDICT", auto-update → no-op).
