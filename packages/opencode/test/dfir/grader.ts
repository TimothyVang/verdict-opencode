// Fixture-driven grader for the offline VERDICT DFIR scorecard.
//
// verdict-opencode is the runtime the caseforge investigate pipeline drives; it does not
// produce verdict.json itself. This grader guards the offline-DFIR contract at the runtime
// layer by scoring a checked-in, real offline run (fixtures/*.verdict.json) against the
// ground-truth oracle — no LLM, no network. The authoritative grader + live harness live in
// caseforge-core (scripts/score-offline-run.mjs); this is the runtime-side regression guard.

export type TechniqueStatus = "HIT" | "PARTIAL" | "MISS"

export interface EvtxTruth {
  event_ids?: number[]
  techniques?: string[]
  cves?: string[]
}
export interface CaseTruth {
  expected_verdict_band?: string
  evtx: Record<string, EvtxTruth>
}
export interface Provenance {
  llm: boolean | null
  kind: "llm-agent" | "deterministic-fallback" | "unknown"
  agent: string | null
  tool_calls: number
}
export interface ScoreResult {
  verdict: string | null
  expected_verdict_band: string | null
  llm_provenance: Provenance
  techniques: { technique: string; status: TechniqueStatus }[]
  cves: { cve: string; status: "HIT" | "MISS" }[]
  total_expected: number
  total_hit: number
  score: number
}

const T_CODE = /\bT\d{4}(?:\.\d{3})?\b/g
const CVE = /\bCVE-\d{4}-\d{4,7}\b/gi

export function collectObservedTechniques(verdict: any): Set<string> {
  const set = new Set<string>()
  const ac = verdict.attack_coverage ?? {}
  for (const t of ac.observed_techniques ?? []) if (t) set.add(String(t).toUpperCase())
  for (const tgt of ac.targets ?? []) {
    if (tgt?.technique_id && /finding|elevat|confirm|observ/i.test(String(tgt.status ?? ""))) {
      set.add(String(tgt.technique_id).toUpperCase())
    }
  }
  for (const f of verdict.findings ?? []) {
    JSON.stringify(f ?? {})
      .match(T_CODE)
      ?.forEach((x) => set.add(x.toUpperCase()))
  }
  return set
}

export function collectCves(verdict: any): Set<string> {
  const set = new Set<string>()
  const add = (s: string) => s.match(CVE)?.forEach((c) => set.add(c.toUpperCase()))
  for (const tgt of verdict.attack_story?.targets ?? []) (tgt.cves ?? []).forEach((c: string) => add(String(c)))
  for (const f of verdict.findings ?? []) add(JSON.stringify(f ?? {}))
  if (Array.isArray(verdict.cves)) verdict.cves.forEach((c: string) => add(String(c)))
  return set
}

export function detectProvenance(verdict: any): Provenance {
  const agent = String(verdict.agent ?? "").toLowerCase()
  const toolCalls = Array.isArray(verdict.tool_calls) ? verdict.tool_calls.length : 0
  if (/find-evil-auto|findevil-auto|auto[- ]?runner|deterministic/.test(agent)) {
    return { llm: false, kind: "deterministic-fallback", agent: verdict.agent ?? null, tool_calls: toolCalls }
  }
  if (/verdict|opencode|gpt-oss|agent|llm/.test(agent)) {
    return { llm: true, kind: "llm-agent", agent: verdict.agent ?? null, tool_calls: toolCalls }
  }
  return { llm: null, kind: "unknown", agent: verdict.agent ?? null, tool_calls: toolCalls }
}

function signalSeen(verdict: any, entry: EvtxTruth): boolean {
  const hay = JSON.stringify({
    t: verdict.normalized_timeline ?? verdict.timeline_summary ?? {},
    e: verdict.evtx_summary ?? {},
    cov: verdict.attack_coverage?.targets ?? [],
  })
  return (entry.event_ids ?? []).some((eid) => hay.includes(String(eid)))
}

export function scoreRun(verdict: any, caseTruth: CaseTruth): ScoreResult {
  const observed = collectObservedTechniques(verdict)
  const cves = collectCves(verdict)
  const expected = new Map<string, EvtxTruth>()
  for (const entry of Object.values(caseTruth.evtx ?? {})) {
    for (const t of entry.techniques ?? []) if (!expected.has(t)) expected.set(t, entry)
  }
  const techniques: { technique: string; status: TechniqueStatus }[] = []
  let hit = 0
  for (const [tech, entry] of expected) {
    let status: TechniqueStatus
    if (observed.has(tech.toUpperCase())) {
      status = "HIT"
      hit++
    } else if (signalSeen(verdict, entry)) {
      status = "PARTIAL"
    } else {
      status = "MISS"
    }
    techniques.push({ technique: tech, status })
  }
  const cveResults: { cve: string; status: "HIT" | "MISS" }[] = []
  for (const entry of Object.values(caseTruth.evtx ?? {})) {
    for (const c of entry.cves ?? []) cveResults.push({ cve: c, status: cves.has(c.toUpperCase()) ? "HIT" : "MISS" })
  }
  const cveHit = cveResults.filter((c) => c.status === "HIT").length
  const totalExpected = expected.size + cveResults.length
  const totalHit = hit + cveHit
  return {
    verdict: verdict.verdict ?? null,
    expected_verdict_band: caseTruth.expected_verdict_band ?? null,
    llm_provenance: detectProvenance(verdict),
    techniques,
    cves: cveResults,
    total_expected: totalExpected,
    total_hit: totalHit,
    score: totalExpected === 0 ? 1 : totalHit / totalExpected,
  }
}
