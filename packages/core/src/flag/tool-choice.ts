import { Flag } from "./flag"

/**
 * Resolve OpenAI-compatible tool_choice for one agent step.
 *
 * - Final max-steps turn always forces `none` so the model must answer in text.
 * - Structured-output turns always force `required` (schema tool).
 * - Otherwise honor OPENCODE_TOOL_CHOICE / VERDICT_FORCE_TOOL_CHOICE when set.
 * - Default remains undefined (provider auto).
 */
export function resolveAgentToolChoice(input: {
  readonly isLastStep: boolean
  readonly structuredRequired?: boolean
}): "auto" | "required" | "none" | undefined {
  if (input.isLastStep) return "none"
  if (input.structuredRequired) return "required"
  const flag = Flag.OPENCODE_TOOL_CHOICE
  if (flag === "required" || flag === "auto" || flag === "none") return flag
  return undefined
}
