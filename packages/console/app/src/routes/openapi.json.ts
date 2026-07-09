export async function GET() {
  const response = await fetch(
    "https://raw.githubusercontent.com/TimothyVang/verdict-opencode/refs/heads/main/packages/sdk/openapi.json",
  )
  const json = await response.json()
  return json
}
