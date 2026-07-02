# VERDICT — a branded fork of opencode

This repository is a **hard fork of [opencode](https://github.com/sst/opencode)**,
rebranded for the [VERDICT](https://github.com/TimothyVang/verdict-dfir) DFIR
toolkit. It tracks upstream and layers VERDICT branding on top of the opencode
application and TUI.

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
| Theme | `packages/tui` (via user theme) | pairs with the VERDICT opencode theme (`verdict-agent-harness/.opencode/themes/verdict.json`) |

Service names that refer to real upstream services (e.g. "opencode Zen",
"opencode Go") are intentionally left intact — this fork still uses them.

## Build & run

Same as upstream (Bun, no Go needed):

```bash
bun install
# run from source:
bun run --cwd packages/opencode --conditions=browser src/index.ts [project]
# or the root dev script:
bun run dev
```

To produce a standalone binary, use upstream's build script
(`packages/opencode/script/build.ts`).

## Re-syncing with upstream

The branding lives in two files (`logo.ts`, `app.tsx`). To update:

```bash
git remote add upstream https://github.com/sst/opencode.git
git fetch upstream
git merge upstream/main   # resolve conflicts in logo.ts / app.tsx if any
```
