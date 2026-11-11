// Domain is env-overridable so the VERDICT fork can deploy its own cloud
// surface without hard-coding anomalyco/opencode.ai infrastructure.
// Defaults preserve upstream opencode.ai when env is unset.
const productionDomain = process.env.VERDICT_CLOUD_DOMAIN || process.env.OPENCODE_CLOUD_DOMAIN || "opencode.ai"
const devDomain =
  process.env.VERDICT_CLOUD_DOMAIN_DEV ||
  process.env.OPENCODE_CLOUD_DOMAIN_DEV ||
  (productionDomain === "opencode.ai" ? "dev.opencode.ai" : `dev.${productionDomain}`)

export const domain = (() => {
  if ($app.stage === "production") return productionDomain
  if ($app.stage === "dev") return devDomain
  return `${$app.stage}.${devDomain}`
})()

// Cloudflare zone for the domain above. Upstream default is opencode.ai's zone.
// Set VERDICT_CLOUD_ZONE_ID when deploying a VERDICT-owned domain.
export const zoneID = process.env.VERDICT_CLOUD_ZONE_ID || process.env.OPENCODE_CLOUD_ZONE_ID || "430ba34c138cfb5360826c4909f99be8"
export const awsStage = $app.stage === "production" ? "production" : "dev"
export const deployAws = $app.stage === awsStage

new cloudflare.RegionalHostname("RegionalHostname", {
  hostname: domain,
  regionKey: "us",
  zoneId: zoneID,
})

const productionShort =
  process.env.VERDICT_CLOUD_SHORT_DOMAIN || process.env.OPENCODE_CLOUD_SHORT_DOMAIN || "opncd.ai"
const devShort =
  process.env.VERDICT_CLOUD_SHORT_DOMAIN_DEV ||
  process.env.OPENCODE_CLOUD_SHORT_DOMAIN_DEV ||
  (productionShort === "opncd.ai" ? "dev.opncd.ai" : `dev.${productionShort}`)

export const shortDomain = (() => {
  if ($app.stage === "production") return productionShort
  if ($app.stage === "dev") return devShort
  return `${$app.stage}.${devShort}`
})()
