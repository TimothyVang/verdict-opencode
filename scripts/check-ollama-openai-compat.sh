#!/usr/bin/env bash
# Optional smoke: Ollama OpenAI-compat /v1/chat/completions is reachable.
#
# Distinguishes:
#   - correct base (.../v1) → OpenAI-shaped error JSON for unknown model (route exists)
#   - bare root (no /v1)  → plain "404 page not found" (the m13 agent-path failure mode)
#
# Offline-friendly: SKIP (exit 0) when host is unset or unreachable.
# Usage:
#   VERDICT_LLM_BASEURL=http://host:11434/v1 bash scripts/check-ollama-openai-compat.sh
#   OLLAMA_HOST=http://host:11434 bash scripts/check-ollama-openai-compat.sh
set -euo pipefail

raw="${VERDICT_LLM_BASEURL:-${OLLAMA_HOST:-${CASEFORGE_SPARK_ENDPOINT:-}}}"
if [[ -z "${raw}" ]]; then
  echo "SKIP: set VERDICT_LLM_BASEURL, OLLAMA_HOST, or CASEFORGE_SPARK_ENDPOINT"
  exit 0
fi

# Strip trailing slash; strip a single trailing /v1 for origin probes.
origin="${raw%/}"
origin="${origin%/v1}"
v1_chat="${origin}/v1/chat/completions"
bare_chat="${origin}/chat/completions"
tags="${origin}/api/tags"

if ! curl -sS -m 2 -o /dev/null "${tags}"; then
  echo "SKIP: Ollama unreachable at ${origin} (tags probe failed)"
  exit 0
fi

body='{"model":"__opencode_ollama_smoke_missing__","messages":[{"role":"user","content":"ping"}]}'

v1_body="$(mktemp)"
bare_body="$(mktemp)"
trap 'rm -f "${v1_body}" "${bare_body}"' EXIT

v1_code="$(curl -sS -m 5 -o "${v1_body}" -w "%{http_code}" \
  -X POST "${v1_chat}" -H "Content-Type: application/json" -d "${body}")"
bare_code="$(curl -sS -m 5 -o "${bare_body}" -w "%{http_code}" \
  -X POST "${bare_chat}" -H "Content-Type: application/json" -d "${body}")"

v1_text="$(cat "${v1_body}")"
bare_text="$(cat "${bare_body}")"

# Route under /v1 must not be the Go/Ollama plain page-not-found body.
if [[ "${v1_text}" == *"404 page not found"* ]]; then
  echo "FAIL: ${v1_chat} returned plain page-not-found (http=${v1_code})"
  echo "  body: ${v1_text}"
  exit 1
fi

# Accept any non-page-not-found response that looks like OpenAI-compat JSON error or success.
if [[ "${v1_text}" != *"error"* && "${v1_text}" != *"choices"* ]]; then
  echo "FAIL: ${v1_chat} unexpected body (http=${v1_code}): ${v1_text}"
  exit 1
fi

# Document the bare-root failure mode (expected when baseURL omits /v1).
if [[ "${bare_text}" != *"404 page not found"* ]]; then
  echo "WARN: bare ${bare_chat} did not return page-not-found (http=${bare_code}); body=${bare_text}"
fi

echo "PASS: Ollama OpenAI-compat reachable"
echo "  origin=${origin}"
echo "  v1_chat=${v1_chat} http=${v1_code}"
echo "  bare_chat=${bare_chat} http=${bare_code} (expect page-not-found when /v1 omitted from baseURL)"
echo "  note: @ai-sdk/openai-compatible POSTs \${baseURL}/chat/completions — baseURL must include /v1"
