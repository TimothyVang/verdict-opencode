import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { scoreRun, detectProvenance, type CaseTruth } from "./grader"

const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"))
const groundTruth = load("ground-truth.json") as { cases: Record<string, CaseTruth> }
const winLat = load("win-lateral-movement.verdict.json")

describe("offline DFIR scorecard (win-lateral-movement, gpt-oss:20b forced, offline)", () => {
  const caseTruth = groundTruth.cases["win-lateral-movement"]
  const result = scoreRun(winLat, caseTruth)

  test("elevates both expected MITRE techniques and the SpoolFool CVE", () => {
    const statusOf = (t: string) => result.techniques.find((x) => x.technique === t)?.status
    expect(statusOf("T1047")).toBe("HIT")
    expect(statusOf("T1543.003")).toBe("HIT")
    expect(result.cves.find((c) => c.cve === "CVE-2022-21999")?.status).toBe("HIT")
    expect(result.total_hit).toBe(3)
    expect(result.total_expected).toBe(3)
  })

  test("case verdict stays in the expected INDETERMINATE band", () => {
    expect(result.verdict).toBe(caseTruth.expected_verdict_band ?? null)
  })

  test("provenance shows the deterministic engine authored the seal, not the LLM", () => {
    // gpt-oss:20b was forced (CASEFORGE_FORCE_AGENT=1) but fell back after repeated invalid
    // tool calls; the seal is find_evil_auto's. This assertion pins that honest fact so a
    // future change that silently claimed LLM authorship would fail here.
    expect(result.llm_provenance.kind).toBe("deterministic-fallback")
    expect(result.llm_provenance.llm).toBe(false)
  })

  test("grader still recognizes a genuinely LLM-authored run", () => {
    expect(detectProvenance({ agent: "verdict (gpt-oss:20b)", tool_calls: [1, 2] }).llm).toBe(true)
  })

  test("grader flags a detection regression when techniques disappear", () => {
    const regressed = JSON.parse(JSON.stringify(winLat))
    regressed.attack_coverage = { observed_techniques: [] }
    regressed.findings = []
    expect(scoreRun(regressed, caseTruth).total_hit).toBeLessThan(result.total_hit)
  })
})
