import type { APIEvent } from "@solidjs/start"
import type { DownloadPlatform } from "../types"

const prodAssetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "opencode-desktop-mac-arm64.dmg",
  "darwin-x64-dmg": "opencode-desktop-mac-x64.dmg",
  "windows-x64-nsis": "opencode-desktop-win-x64.exe",
  "linux-x64-deb": "opencode-desktop-linux-amd64.deb",
  "linux-x64-appimage": "opencode-desktop-linux-x86_64.AppImage",
  "linux-x64-rpm": "opencode-desktop-linux-x86_64.rpm",
} satisfies Record<DownloadPlatform, string>

const betaAssetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "opencode-desktop-mac-arm64.dmg",
  "darwin-x64-dmg": "opencode-desktop-mac-x64.dmg",
  "windows-x64-nsis": "opencode-desktop-win-x64.exe",
  "linux-x64-deb": "opencode-desktop-linux-amd64.deb",
  "linux-x64-appimage": "opencode-desktop-linux-x86_64.AppImage",
  "linux-x64-rpm": "opencode-desktop-linux-x86_64.rpm",
} satisfies Record<DownloadPlatform, string>

// Doing this on the server lets us preserve the original name for platforms we don't care to rename for
const downloadNames: Record<string, string> = {
  "darwin-aarch64-dmg": "VERDICT Desktop.dmg",
  "darwin-x64-dmg": "VERDICT Desktop.dmg",
  "windows-x64-nsis": "VERDICT Desktop Installer.exe",
} satisfies { [K in DownloadPlatform]?: string }

export async function GET({ params: { platform, channel } }: APIEvent) {
  const assetName = channel === "stable" ? prodAssetNames[platform] : betaAssetNames[platform]
  if (!assetName) return new Response(null, { status: 404 })

  // VERDICT fork: desktop artifacts publish from TimothyVang/verdict-opencode when available.
  // Fall back path still uses the same asset names as upstream packaging.
  const ghOrg = process.env.VERDICT_GITHUB_ORG || "TimothyVang"
  const ghRepo =
    process.env.VERDICT_GITHUB_DESKTOP_REPO ||
    (channel === "stable" ? "verdict-opencode" : "verdict-opencode")
  const resp = await fetch(
    `https://github.com/${ghOrg}/${ghRepo}/releases/latest/download/${assetName}`,
  )

  const downloadName = downloadNames[platform]

  const headers = new Headers(resp.headers)
  if (downloadName) headers.set("content-disposition", `attachment; filename="${downloadName}"`)

  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers })
}
