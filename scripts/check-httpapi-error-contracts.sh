#!/usr/bin/env bash
# Run structural + public OpenAPI HttpApi error-contract tests (offline-friendly).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/packages/opencode"
exec bun test test/server/httpapi-error-contracts-source.test.ts test/server/httpapi-public-openapi.test.ts
