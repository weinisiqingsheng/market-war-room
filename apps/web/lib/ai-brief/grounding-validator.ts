/**
 * Phase 7B.2 — deterministic post-generation grounding validator.
 * Verifies reference integrity, ticker/catalyst alignment, controlled causal
 * language, catalyst-strength language, exact-number reuse, obvious invented
 * future events, and deterministic confidence consistency. NOT semantic
 * entailment. Pure: no fetch/env/LLM; evidence is inert data only.
 */
import type { GroundedMarketBrief } from "./brief-types";
import type { BriefContext, EvidenceFact } from "./types";
import type { GroundingIssue, GroundingIssueCode, GroundingValidationResult } from "./grounding-types";

const ABSOLUTE_CAUSALITY_PATTERNS = [/\b(?:definitely|directly)\s+caused\b/i, /\bcaused\b/i, /\bwas caused by\b/i, /\bconfirmed cause\b/i, /\bproved that\b/i];
const EVENT_TERMS = ["earnings", "guidance", "eps", "analyst", "merger", "acqui", "regulatory", "offering", "convertible", "buyback", "dividend", "contract", "product launch", "ceo", "cfo", "filing", "fhfa", "vantagescore", "catalyst", "matched catalyst", "results", "revenue", "upgraded", "downgraded"];
const NO_CATALYST_ALLOWED = /no sufficiently strong|no clear (?:company-specific )?catalyst|no clear company-specific explanation/i;
const FINANCIAL_NUMBER = /(?:\d+\.\d+|\d+\s*(?:%|bps|\/100|\$|×|x|billion|million))/i;
const FUTURE_MARKERS = /\b(?:tomorrow|next week|next month|upcoming|scheduled|due|will report|will release|on (?:monday|tuesday|wednesday|thursday|friday))\b/i;
const FUTURE_EVENT_TERMS = /\b(?:CPI|PPI|payrolls|jobs report|FOMC|Fed meeting|economic report|data release)\b/i;

function eventLanguage(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return EVENT_TERMS.some((term) => lower.includes(` ${term}`) || lower.includes(`${term} `) || lower.includes(`${term},`) || lower.includes(`${term}.`));
}
function strengthOf(fact: EvidenceFact | undefined): string | null {
  if (!fact) return null;
  const strength = typeof fact.data.evidenceStrength === "string" ? fact.data.evidenceStrength.toLowerCase() : "";
  return ["strong", "moderate", "weak"].includes(strength) ? strength : null;
}
function numberTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const pattern = /(-?\d+(?:\.\d+)?)\s*(%|bps|\/100|\$|×|x|d|m|b|billion|million)?/gi;
  for (const match of text.matchAll(pattern)) {
    const value = Number.parseFloat(match[1] ?? "");
    if (Number.isNaN(value)) continue;
    const unit = (match[2] ?? "").toLowerCase().replace(/×/g, "x");
    tokens.add(`${value.toFixed(6)}|${unit}`);
  }
  return tokens;
}
function unsupportedNumbers(text: string, evidenceSurface: string): string[] {
  const claimed = numberTokens(text);
  const permitted = numberTokens(evidenceSurface);
  const out: string[] = [];
  for (const token of claimed) if (!permitted.has(token)) out.push(token);
  return out;
}
function inventedFutureEvent(text: string, evidenceSurface: string): boolean {
  if (!FUTURE_MARKERS.test(text)) return false;
  if (!FUTURE_EVENT_TERMS.test(text)) return false;
  const hit = text.toLowerCase().match(FUTURE_EVENT_TERMS);
  return hit === null || hit[0].length === 0 || !evidenceSurface.toLowerCase().includes(hit[0]);
}
function factMap(context: BriefContext): Map<string, EvidenceFact> {
  return new Map(context.evidence.map((fact) => [fact.id, fact]));
}
function issue(code: GroundingIssueCode, path: string, message: string): GroundingIssue {
  return { code, path, message };
}

export function validateGroundedMarketBrief(brief: GroundedMarketBrief, context: BriefContext): GroundingValidationResult {
  const issues: GroundingIssue[] = [];
  const facts = factMap(context);
  const surfaceOf = (refs: string[]) => refs.map((ref) => facts.get(ref)?.text ?? "").join(" ");

  if (context.inputConfidence.label === "insufficient") {
    return { valid: false, issues: [issue("INSUFFICIENT_CONTEXT", "dataQuality.confidence", "Input confidence is insufficient; a normal ai-brief-v1 cannot be grounded.")] };
  }

  // 1 · evidence refs must resolve.
  const claimUnits: Array<{ path: string; text: string; refs: string[] }> = [
    { path: "stance.summary", text: brief.stance.summary, refs: brief.stance.evidenceRefs },
    ...brief.overview.map((unit, index) => ({ path: `overview[${index}].text`, text: unit.text, refs: unit.evidenceRefs })),
    ...brief.keyDrivers.map((unit, index) => ({ path: `keyDrivers[${index}].text`, text: unit.text, refs: unit.evidenceRefs })),
    { path: "marketInternals.text", text: brief.marketInternals.text, refs: brief.marketInternals.evidenceRefs },
    { path: "macro.text", text: brief.macro.text, refs: brief.macro.evidenceRefs },
    ...brief.notableMoves.map((unit, index) => ({ path: `notableMoves[${index}].text`, text: unit.text, refs: unit.evidenceRefs })),
    ...brief.watchNext.map((unit, index) => ({ path: `watchNext[${index}].text`, text: unit.text, refs: unit.evidenceRefs })),
    { path: "dataQuality.text", text: brief.dataQuality.text, refs: brief.dataQuality.evidenceRefs },
  ];
  const seenRefs = new Set<string>();
  for (const unit of claimUnits) {
    for (const ref of unit.refs) {
      const key = `${unit.path}::${ref}`;
      if (seenRefs.has(key)) continue;
      seenRefs.add(key);
      if (!facts.has(ref)) issues.push(issue("UNKNOWN_EVIDENCE_REF", unit.path, `Unknown evidence ref "${ref}".`));
    }
  }
  // 2 · Stance anchor.
  if (facts.has("regime.overall") && !brief.stance.evidenceRefs.includes("regime.overall")) {
    issues.push(issue("STANCE_MISSING_REGIME_REF", "stance.evidenceRefs", "Stance must reference regime.overall when it exists."));
  }
  // 3 · Conservative section-domain alignment.
  if ([...facts.keys()].some((id) => id.startsWith("macro.")) && !brief.macro.evidenceRefs.some((ref) => ref.startsWith("macro."))) {
    issues.push(issue("SECTION_DOMAIN_MISMATCH", "macro.evidenceRefs", "macro section must reference a macro.* fact."));
  }
  if (([...facts.keys()].some((id) => id.startsWith("breadth.")) || [...facts.keys()].some((id) => id.startsWith("sector."))) &&
      !brief.marketInternals.evidenceRefs.some((ref) => ref.startsWith("breadth.") || ref.startsWith("sector."))) {
    issues.push(issue("SECTION_DOMAIN_MISMATCH", "marketInternals.evidenceRefs", "marketInternals must reference breadth.* or sector.*."));
  }
  // 4 · Headline numbers (no refs allowed) and global absolute causality.
  if (FINANCIAL_NUMBER.test(brief.headline)) {
    issues.push(issue("UNSUPPORTED_NUMBER", "headline", "Headline must be qualitative; it cannot contain exact market/statistical numbers."));
  }
  const allProse = [brief.stance.summary, ...brief.overview.map((u) => u.text), ...brief.keyDrivers.map((u) => u.text), brief.marketInternals.text, brief.macro.text, ...brief.notableMoves.map((u) => u.text), ...brief.watchNext.map((u) => u.text), brief.dataQuality.text];
  for (const text of allProse) {
    if (ABSOLUTE_CAUSALITY_PATTERNS.some((pattern) => pattern.test(text))) {
      issues.push(issue("ABSOLUTE_CAUSALITY", "text", "Absolute causal language is not allowed."));
    }
  }

  // 5 · Notable-move alignment, catalyst language, numbers, future events.
  brief.notableMoves.forEach((move, index) => {
    const path = `notableMoves[${index}]`;
    const ticker = move.ticker;
    const anomalyFact = facts.get(`anomaly.${ticker}`);
    if (!anomalyFact) {
      issues.push(issue("UNKNOWN_NOTABLE_TICKER", `${path}.ticker`, `No anomaly evidence for ${ticker}.`));
      return;
    }
    if (!move.evidenceRefs.includes(`anomaly.${ticker}`)) {
      issues.push(issue("MISSING_ANOMALY_REF", `${path}.evidenceRefs`, `Must reference anomaly.${ticker}.`));
    }
    for (const ref of move.evidenceRefs) {
      if (ref.startsWith("catalyst.") && ref !== `catalyst.${ticker}.primary` && ref !== `catalyst.${ticker}.none`) {
        issues.push(issue("CROSS_TICKER_CATALYST_REF", `${path}.evidenceRefs`, `Cross-ticker catalyst ref "${ref}" is invalid.`));
      }
    }
    const primaryFact = facts.get(`catalyst.${ticker}.primary`);
    const noneFact = facts.get(`catalyst.${ticker}.none`);
    if (noneFact && !primaryFact) {
      if (eventLanguage(move.text) && !NO_CATALYST_ALLOWED.test(move.text)) {
        issues.push(issue("NO_CLEAR_CATALYST_CONTRADICTION", `${path}.text`, `No company-specific catalyst was identified for ${ticker}; event attribution is invalid.`));
      }
    } else if (primaryFact) {
      if (eventLanguage(move.text) && !move.evidenceRefs.includes(`catalyst.${ticker}.primary`)) {
        issues.push(issue("MISSING_CATALYST_REF", `${path}.evidenceRefs`, `Company-specific event text requires catalyst.${ticker}.primary.`));
      }
      const strength = strengthOf(primaryFact) ?? "weak";
      const text = move.text.toLowerCase();
      if (strength === "moderate" || strength === "weak") {
        const banned = strength === "weak" ? /\blikely catalyst\b|\bstrong(?:ly)? evidence\b|\bstrongly matched\b/ : /\bstrong(?:ly)? evidence\b|\bstrongly matched\b/;
        if (banned.test(text)) issues.push(issue("CATALYST_STRENGTH_OVERSTATEMENT", `${path}.text`, `Language overstates a ${strength} catalyst.`));
      }
    }
    const unsupported = unsupportedNumbers(move.text, surfaceOf(move.evidenceRefs));
    if (unsupported.length > 0) {
      issues.push(issue("UNSUPPORTED_NUMBER", `${path}.text`, `Exact numbers not present in referenced evidence: ${unsupported.join(", ")}.`));
    }
  });

  // 6 · Claim-unit numeric grounding (notableMoves already checked above).
  for (const unit of claimUnits) {
    if (unit.path.startsWith("notableMoves")) continue;
    const unsupported = unsupportedNumbers(unit.text, surfaceOf(unit.refs));
    if (unsupported.length > 0) {
      issues.push(issue("UNSUPPORTED_NUMBER", unit.path, `Exact numbers not present in referenced evidence: ${unsupported.join(", ")}.`));
    }
  }

  // 7 · Invented future events across claim units.
  for (const unit of claimUnits) {
    if (inventedFutureEvent(unit.text, surfaceOf(unit.refs))) {
      issues.push(issue("UNSUPPORTED_FUTURE_EVENT", unit.path, "Invented scheduled future event is not supported by evidence."));
    }
  }

  // 8 · Data-quality confidence must match the deterministic context confidence.
  if (brief.dataQuality.confidence !== context.inputConfidence.label) {
    issues.push(issue("DATA_QUALITY_CONFIDENCE_MISMATCH", "dataQuality.confidence", "Brief confidence must equal context inputConfidence.label."));
  }

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

