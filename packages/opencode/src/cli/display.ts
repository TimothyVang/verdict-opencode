import path from "path"

function normalizeName(value: string | undefined) {
  const base = path.basename(value ?? "").replace(/\.exe$/i, "")
  if (!base || base === "bun" || base === "node" || base === "index.ts" || base === "temporary.ts") return
  return base
}

export function cliDisplayName(input?: { argv?: string[]; execPath?: string; env?: NodeJS.ProcessEnv }) {
  const env = input?.env ?? process.env
  const override = env.VERDICT_CLI_NAME || env.OPENCODE_CLI_NAME
  if (override?.trim()) return override.trim()

  const argv = input?.argv ?? process.argv
  return normalizeName(input?.execPath ?? process.execPath) || normalizeName(argv[1]) || "opencode"
}

export function cliProductName(input?: { argv?: string[]; execPath?: string; env?: NodeJS.ProcessEnv }) {
  const displayName = cliDisplayName(input)
  return displayName.toLowerCase() === "verdict" ? "VERDICT" : displayName
}

export function authUsernameDescription(input?: { argv?: string[]; execPath?: string; env?: NodeJS.ProcessEnv }) {
  const suffix = cliDisplayName(input).toLowerCase() === "opencode" ? " or 'opencode'" : " or built-in username"
  return `basic auth username (defaults to OPENCODE_SERVER_USERNAME${suffix})`
}

export function providersDescription(input?: { argv?: string[]; execPath?: string; env?: NodeJS.ProcessEnv }) {
  return cliDisplayName(input).toLowerCase() === "opencode"
    ? "manage AI providers and credentials"
    : `manage ${cliProductName(input)} providers and credentials`
}

export * as CliDisplay from "./display"
