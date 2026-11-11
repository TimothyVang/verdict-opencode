#!/usr/bin/env bash
#
# verdict-cloud-rebrand.sh — apply VERDICT chrome to the opencode *cloud console*
# and related web packages (not the local CLI/TUI engine — use verdict-rebrand.sh
# for that).
#
# Safe to re-run. Does NOT rewrite functional identifiers, package names, or
# SST resource type names. Does rewrite user-visible marketing strings and
# install/docs URLs toward the VERDICT fork defaults.
#
# Env (optional):
#   VERDICT_INSTALL_URL   default: https://github.com/TimothyVang/verdict-opencode
#   VERDICT_GITHUB_ORG    default: TimothyVang
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INSTALL_URL="${VERDICT_INSTALL_URL:-https://github.com/TimothyVang/verdict-opencode}"
GH_ORG="${VERDICT_GITHUB_ORG:-TimothyVang}"

CONSOLE_APP="packages/console/app/src"
WEB="packages/web"
ENTERPRISE="packages/enterprise"

echo "[verdict-cloud-rebrand] applying console/web chrome in $ROOT"

# Scope: console app chrome only (not packages/web i18n corpus, not legal/).
# Legal pages stay upstream until VERDICT-specific terms exist.
# Non-English i18n left intact to avoid half-translated legal/marketing drift.

if [ -f "$CONSOLE_APP/i18n/en.ts" ]; then
  perl -i -pe 's/\bOpenCode\b(?! (?:Zen|Go)\b)/VERDICT/g' "$CONSOLE_APP/i18n/en.ts"
fi

# Marketing install / download hosts (console download + landing)
if [ -d "$CONSOLE_APP/routes" ]; then
  find "$CONSOLE_APP/routes" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/legal/*' -print0 \
    | xargs -0 -r perl -i -pe "
      s/\bOpenCode\b(?! (?:Zen|Go)\b)/VERDICT/g;
      s#https://opencode\\.ai/install#${INSTALL_URL}#g;
      s#anomalyco/tap/opencode#${GH_ORG}/verdict-opencode#g;
      s#anomalyco/opencode#${GH_ORG}/verdict-opencode#g;
      s#OpenCode Desktop#VERDICT Desktop#g;
      s/docs\\.opencode\\.ai/docs.verdict.local/g;
      s/docs\\.dev\\.opencode\\.ai/docs.dev.verdict.local/g;
    "
fi

# config + changelog chrome
for f in "$CONSOLE_APP/config.ts" "$CONSOLE_APP/lib/changelog.ts"; do
  if [ -f "$f" ]; then
    perl -i -pe 's/\bOpenCode\b(?! (?:Zen|Go)\b)/VERDICT/g' "$f"
  fi
done

echo "[verdict-cloud-rebrand] done."
echo "  Review: git diff --stat packages/console packages/web packages/enterprise"
echo "  Domain deploy: set VERDICT_CLOUD_DOMAIN / VERDICT_CLOUD_ZONE_ID (see docs/CLOUD.md)"
