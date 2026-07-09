/**
 * Application-wide constants and configuration (VERDICT fork defaults).
 *
 * Public URL for links can be overridden at build/runtime:
 *   VITE_PUBLIC_BASE_URL=https://cloud.example.com
 * Domain for SST deploy is separate (infra/stage.ts VERDICT_CLOUD_DOMAIN).
 */
const publicBase =
  (typeof process !== "undefined" &&
    (process.env.VITE_PUBLIC_BASE_URL || process.env.VERDICT_CLOUD_BASE_URL)) ||
  "https://opencode.ai"

export const config = {
  // Public site base (workspace/billing links, landing). Override for VERDICT deploy.
  baseUrl: publicBase.replace(/\/$/, ""),

  // GitHub (VERDICT fork)
  github: {
    org: "TimothyVang",
    repo: "verdict-opencode",
    repoUrl: "https://github.com/TimothyVang/verdict-opencode",
    starsFormatted: {
      compact: "—",
      full: "—",
    },
  },

  // Install / clone instructions for the fork (no opencode.ai install pipe)
  install: {
    highlight: "github.com/TimothyVang/verdict-opencode",
    // Honest fork path: clone + bun (not upstream install script)
    command: "git clone https://github.com/TimothyVang/verdict-opencode.git && cd verdict-opencode && bun install",
    npm: "see github.com/TimothyVang/verdict-opencode (build from source)",
  },

  // Social links — keep upstream community until VERDICT has its own
  social: {
    twitter: "https://x.com/opencode",
    discord: "https://discord.gg/opencode",
  },

  // Static stats (upstream marketing; not claimed as VERDICT metrics)
  stats: {
    contributors: "900",
    commits: "13,000",
    monthlyUsers: "7.5M",
  },
} as const

/** Absolute URL on the public console host (for emails / workspace deep links). */
export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${config.baseUrl}${p}`
}
