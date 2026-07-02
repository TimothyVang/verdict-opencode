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
| Theme | `packages/tui` (via user theme) | pairs with the VERDICT opencode theme (`verdict-agent-harness/.opencode/themes/verdict.json`) |

Intentionally **left intact** (not cosmetic app chrome): real upstream service
names ("opencode Zen", "opencode Go"), the `opencode serve`/`opencode.json`
commands & config keys, HTTP-API doc strings and code identifiers
(`OpenCodeHttpApi`), and the agent **system prompts** ("You are OpenCode …") —
renaming the agent persona is a behavioral change, not branding.

<p align="center"><img src=".verdict/tui-verdict-binary.png" alt="Compiled VERDICT binary" width="720"></p>
<p align="center"><sub>The compiled standalone <code>verdict</code> binary — VERDICT wordmark + titlebar, no auto-update dialog.</sub></p>

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

The branding lives in two files (`logo.ts`, `app.tsx`). To update:

```bash
git remote add upstream https://github.com/sst/opencode.git
git fetch upstream
git merge upstream/main   # resolve conflicts in logo.ts / app.tsx if any
```
