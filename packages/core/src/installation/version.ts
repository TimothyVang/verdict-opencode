declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

/**
 * Version pin for installing `@opencode-ai/plugin` on non-local builds.
 *
 * npm-package-arg treats any string containing `/` as a github `owner/repo`
 * remote. Preview builds stamped from slash-containing branch names
 * (`0.0.0-agent/m4-…`) therefore hang on `git ls-remote` during config
 * dependency install. Skip the pin when the version is not npm-safe.
 */
export function pluginDependencyVersion(version: string | undefined = InstallationVersion) {
  if (!version) return
  if (version.includes("/")) return
  return version
}
