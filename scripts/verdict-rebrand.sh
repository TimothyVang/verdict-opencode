#!/usr/bin/env bash
#
# verdict-rebrand.sh — idempotently apply VERDICT branding to an opencode tree.
#
# Safe to run repeatedly and against a freshly-synced upstream checkout. Re-run
# this after pulling upstream changes (see VERDICT-FORK.md "Re-syncing").
#
# What it does:
#   1. Overwrites the TUI logo with the VERDICT wordmark art.
#   2. Overwrites cli/upgrade.ts with a no-op (disables auto-update).
#   3. Rewrites the terminal-title session prefix `OC | ` -> `VERDICT | `.
#   4. Sweeps every standalone word "OpenCode" -> "VERDICT" across TUI + opencode
#      source (this covers the block-title string, app-name strings, and the
#      agent system-prompt persona).
#
# Deliberately preserved (NOT rebranded — these are functional, not chrome):
#   - Code identifiers (OpenCodeHttpApi, OpenCodeAssistantMessage): the \b word
#     boundary never matches inside CamelCase, so they are untouched.
#   - opencode commands / config keys / package names / URLs (lowercase).
#   - Real upstream services "OpenCode Zen" / "OpenCode Go".
#   - The provider billing header in provider/provider.ts (whole file excluded).
#
# Review `git diff` after every run: an upstream update may introduce new
# functional "OpenCode" strings (e.g. headers) that this sweep should not touch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TUI_SRC="packages/tui/src"
OC_SRC="packages/opencode/src"

echo "[verdict-rebrand] applying branding in $ROOT"

# 1 + 2: full-file assets
cp ".verdict/assets/logo.ts" "$TUI_SRC/logo.ts"
cp ".verdict/assets/upgrade.ts" "$OC_SRC/cli/upgrade.ts"

# 3: terminal-title session prefix (the word-sweep below handles the plain
#    "OpenCode" title string; this handles the abbreviated `OC | ` prefix).
perl -i -pe 's/\bOC \| /VERDICT | /g' "$TUI_SRC/app.tsx"

# 4: standalone "OpenCode" -> "VERDICT" across source, excluding the billing
#    header file. \b protects CamelCase identifiers; Zen/Go are preserved.
find "$OC_SRC" "$TUI_SRC" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.txt' \) \
  ! -path "*/provider/provider.ts" -print0 \
  | xargs -0 perl -i -pe 's/\bOpenCode\b(?! (?:Zen|Go)\b)/VERDICT/g'

remaining="$(grep -roP '\bOpenCode\b(?! (?:Zen|Go)\b)' "$OC_SRC" "$TUI_SRC" \
  --include='*.ts' --include='*.tsx' --include='*.txt' 2>/dev/null \
  | grep -v 'provider/provider.ts' | wc -l | tr -d ' ' || true)"

echo "[verdict-rebrand] done. Remaining standalone 'OpenCode' (want 0, excludes billing header): $remaining"
if [ "$remaining" != "0" ]; then
  echo "[verdict-rebrand] NOTE: review the occurrences above — new upstream strings may need classifying." >&2
fi
