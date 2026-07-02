// VERDICT fork: auto-update is disabled by design.
//
// Upstream releases are stock opencode; letting the app self-update would
// overwrite the VERDICT-branded binary. This function is intentionally a no-op
// (the original update-check/notify/install logic lives in upstream opencode).
export async function upgrade(): Promise<void> {
  return
}
