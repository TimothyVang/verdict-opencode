# VERDICT cloud (opencode console fork)

This repo ships two surfaces:

| Surface | What it is | VERDICT status |
|---------|------------|----------------|
| **Local engine** | `packages/opencode` → `verdict` binary (CLI/TUI) | Primary DFIR path (caseforge + local LLM) |
| **Cloud console** | `packages/console/*` + `infra/*` + SST on Cloudflare | Fork of upstream opencode.ai console — optional, **not** required for DFIR |

Real evidence stays **local by default**. Cloud console is for account/workspace UX,
docs, downloads, and optional hosted agent features — never a silent path for private
case evidence.

## Why this file exists

Upstream cloud hard-codes:

- Domains: `opencode.ai` / `dev.opencode.ai` (`infra/stage.ts`)
- Cloudflare zone ID for that domain
- PlanetScale org, Stripe, GitHub OAuth secrets (SST secrets)
- Marketing install URLs (`opencode.ai/install`, `anomalyco/tap/opencode`)

A VERDICT deployment must use **VERDICT-owned** DNS, zone, and secrets.

## Domain override (this fork)

`infra/stage.ts` reads (optional):

| Env | Purpose |
|-----|---------|
| `VERDICT_CLOUD_DOMAIN` | Production host (default `opencode.ai` if unset) |
| `VERDICT_CLOUD_DOMAIN_DEV` | Dev host (default `dev.<production>` or `dev.opencode.ai`) |
| `VERDICT_CLOUD_ZONE_ID` | Cloudflare zone ID for that domain |
| `VERDICT_CLOUD_SHORT_DOMAIN` | Short link host (default `opncd.ai`) |
| `VERDICT_CLOUD_SHORT_DOMAIN_DEV` | Dev short host |
| `VITE_PUBLIC_BASE_URL` / `VERDICT_CLOUD_BASE_URL` | Console `config.baseUrl` for workspace/billing deep links |
| `VERDICT_GITHUB_ORG` | GitHub org for desktop download redirects (default `TimothyVang`) |

Example:

```bash
export VERDICT_CLOUD_DOMAIN=cloud.verdict.example
export VERDICT_CLOUD_DOMAIN_DEV=dev.cloud.verdict.example
export VERDICT_CLOUD_ZONE_ID=<your-cloudflare-zone-id>
# then: bunx sst deploy --stage dev
```

## Chrome rebrand

```bash
bun run verdict:rebrand          # local engine TUI/CLI (existing)
bash scripts/verdict-cloud-rebrand.sh   # console/web marketing chrome
```

`verdict-cloud-rebrand.sh` is idempotent for word-boundary `OpenCode` → `VERDICT` and
rewrites common install/GitHub marketing strings toward
`TimothyVang/verdict-opencode`. **Always `git diff` after running.**

## Local console UI (no Cloudflare deploy)

Does not need Spark or live SST secrets for static UI iteration:

```bash
bun install
bun run dev:console
# packages/console/app Vite on 0.0.0.0 — auth/API may  fail without sst shell
```

Remote-backed dev (needs SST stage + secrets):

```bash
bun run --cwd packages/console/app dev:remote
# uses VITE_AUTH_URL=https://auth.dev.opencode.ai by default — override for VERDICT stage
```

## Deploy prerequisites (checklist)

- [ ] Cloudflare account + zone for `VERDICT_CLOUD_DOMAIN`
- [ ] SST secrets (GitHub OAuth, Google OAuth, Stripe, PlanetScale) for **your** org
- [ ] Do **not** use anomalyco PlanetScale org / production Stripe keys
- [ ] Re-run both rebrand scripts after upstream sync
- [ ] Privacy: console must not become a default path for real evidence

## Relation to DFIR stack

```
caseforge (driver) → verdict binary (this repo, local) → findevil MCP (dev toolkit)
                         ↑
              cloud console is optional side surface (accounts/docs/download)
```

DFIR milestones (FORCE_AGENT, seals, sample-run) do **not** block on cloud deploy.

## Branch / worktree

Operator worktree for this stream:

```text
verdict-worktrees/oc-cloud   branch agent/verdict-cloud
tmux session: verdict-opencode-cloud
```
