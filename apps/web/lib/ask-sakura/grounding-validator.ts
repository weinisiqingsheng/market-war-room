import type { AskEvidenceFact } from "./evidence-fact";
import type { AskSakuraAnswer, AskTextUnit } from "./types";
import type { AskEvidenceSelection } from "./select-evidence";
import type {
  AskGroundingIssue,
  AskGroundingIssueCode,
  AskGroundingResult,
} from "./grounding-types";

const ABSOLUTE_CAUSALITY =
  /(?:\b(?:definitely|directly|confirmed|proved)\s+caused\b|\bcaused\b|\bbecause\b|\bdue to\b|\bdriven by\b|\bled to\b|\bresulted in\b)/i;
const NO_CATALYST_ALLOWED =
  /no sufficiently strong|no clear (?:company-specific )?catalyst|no clear company-specific explanation/i;
const EVENT_TERMS = [
  "guidance",
  "earnings",
  "eps",
  "analyst",
  "merger",
  "acqui",
  "regulatory",
  "offering",
  "convertible",
  "buyback",
  "dividend",
  "contract",
  "product launch",
  "ceo",
  "cfo",
  "filing",
  "catalyst",
  "results",
  "revenue",
  "upgraded",
  "downgraded",
];
const FUTURE_MARKERS =
  /\b(?:tomorrow|next week|next month|upcoming|scheduled|due|will report|will release|on (?:monday|tuesday|wednesday|thursday|friday))\b/i;
const SCHEDULED_EVENT_TERMS =
  /\b(?:earnings|guidance|report|release|results|CPI|PPI|payrolls|jobs report|FOMC|Fed meeting|economic report|data release)\b/i;

function eventLanguage(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return EVENT_TERMS.some(
    (term) =>
      lower.includes(` ${term}`) ||
      lower.includes(`${term} `) ||
      lower.includes(`${term},`) ||
      lower.includes(`${term}.`),
  );
}

function issue(code: AskGroundingIssueCode, path: string, message: string): AskGroundingIssue {
  return { code, path, message };
}

function numberTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  // V1.2B: collapse thousands separators inside numeric literals so that
  // "191,619,629" and "191619629" are the SAME number for validation purposes.
  // Normalization is applied to both the claim and the evidence surface, so no
  // additional numbers become permissible.
  const normalized = text.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const pattern = /(-?\d+(?:\.\d+)?)\s*(%|bps|\/100|\$|×|x|d|m|b|billion|million)?/gi;
  for (const match of normalized.matchAll(pattern)) {
    const value = Number.parseFloat(match[1] ?? "");
    if (Number.isNaN(value)) continue;
    const unit = (match[2] ?? "").toLowerCase().replace(/×/g, "x");
    tokens.add(`${value.toFixed(6)}|${unit}`);
  }
  return tokens;
}

function unsupportedNumbers(text: string, surface: string): string[] {
  const claimed = numberTokens(text);
  const permitted = numberTokens(surface);
  const out: string[] = [];
  for (const token of claimed) if (!permitted.has(token)) out.push(token);
  return out;
}

function inventedFutureEvent(text: string, surface: string): boolean {
  if (!FUTURE_MARKERS.test(text)) return false;
  const hit = text.toLowerCase().match(SCHEDULED_EVENT_TERMS);
  if (!hit || hit[0].length === 0) return false;
  return !surface.toLowerCase().includes(hit[0]);
}

function mentionedTickers(text: string, symbols: Set<string>): string[] {
  const tokens = text.toUpperCase().match(/[A-Z][A-Z0-9.-]{0,9}/g) ?? [];
  return Array.from(
    new Set(
      tokens.map((token) => token.replace(/[.-]+$/, "")).filter((token) => symbols.has(token)),
    ),
  );
}

function strengthOf(fact: AskEvidenceFact | undefined): string | null {
  if (!fact) return null;
  const strength =
    typeof fact.data.evidenceStrength === "string" ? fact.data.evidenceStrength.toLowerCase() : "";
  return ["strong", "moderate", "weak"].includes(strength) ? strength : null;
}

/** V1.2B: on-demand ticker packs expose contextual (unpromoted) event evidence. */
const CONTEXT_ONLY_SUFFIXES = ["news.", "sec.", "corporateAction."];
const CATALYST_PROMOTION =
  /\b(?:explains?|explained|catalyst(?: for)?|reason for|responsible for|account(?:s|ed) for|the cause)\b/i;
const FORECAST_PATTERNS = [
  /\bprice targets?\b/i,
  /\btarget price\b/i,
  /\bwill (?:rise|fall|climb|drop|rally|decline|surge|slump)\b/i,
  /\b(?:expect|expects|expected) to (?:rise|fall|climb|drop|rally|decline)\b/i,
  /\bforecast(?:s|ed)? (?:a )?(?:price|move|upside|downside|gain|loss)\b/i,
  /\b(?:upside|downside) of \d/i,
  /\bprobability of \d+\s*%/i,
];
const NEGATION =
  /\b(?:not|no|never|cannot|can't|does not|doesn't|do not|don't|unable|without|avoid|won't|wouldn't|isn't|aren't)\b/i;

function isContextOnlyTickerRef(ref: string, ticker: string): boolean {
  const prefix = `ticker.${ticker}.`;
  if (!ref.startsWith(prefix)) return false;
  const rest = ref.slice(prefix.length);
  return CONTEXT_ONLY_SUFFIXES.some((suffix) => rest.startsWith(suffix));
}

/** `catalyst.<T>.none` (global) or `ticker.<T>.catalyst` status "none" (on-demand). */
function hasNoneCatalyst(factMap: Map<string, AskEvidenceFact>, ticker: string): boolean {
  if (factMap.has(`catalyst.${ticker}.none`) && !factMap.has(`catalyst.${ticker}.primary`)) {
    return true;
  }
  return factMap.get(`ticker.${ticker}.catalyst`)?.data.status === "none";
}

/** Forecast language asserted positively (negated/discouraged phrasing is fine). */
function assertedForecast(text: string): boolean {
  for (const pattern of FORECAST_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 48), match.index ?? 0);
    if (!NEGATION.test(prefix)) return true;
  }
  return false;
}

interface ClaimUnit {
  path: string;
  text: string;
  refs: string[];
}

function collectUnits(answer: AskSakuraAnswer): ClaimUnit[] {
  const units: ClaimUnit[] = [
    { path: "answer.answer", text: answer.answer.text, refs: answer.answer.evidenceRefs },
  ];
  answer.supportingPoints.forEach((point: AskTextUnit, i) =>
    units.push({
      path: `answer.supportingPoints[${i}]`,
      text: point.text,
      refs: point.evidenceRefs,
    }),
  );
  answer.limitations.forEach((limitation: AskTextUnit, i) =>
    units.push({
      path: `answer.limitations[${i}]`,
      text: limitation.text,
      refs: limitation.evidenceRefs,
    }),
  );
  return units;
}

function allProse(answer: AskSakuraAnswer): string[] {
  return [
    answer.answer.text,
    ...answer.supportingPoints.map((p) => p.text),
    ...answer.limitations.map((p) => p.text),
  ];
}

export function validateAskSakuraAnswer(
  answer: AskSakuraAnswer,
  facts: AskEvidenceFact[],
  selection: Pick<AskEvidenceSelection, "detectedTickers" | "selectionMode">,
): AskGroundingResult {
  const issues: AskGroundingIssue[] = [];
  const factMap = new Map(facts.map((fact) => [fact.id, fact]));
  const symbols = new Set(
    facts.flatMap((fact) => {
      const parts = fact.id.split(".");
      if (
        ["anomaly", "catalyst", "sector", "market", "ticker"].includes(parts[0] ?? "") &&
        (parts[1] ?? "")
      ) {
        return [parts[1].toUpperCase()];
      }
      return [];
    }),
  );
  const surfaceOf = (refs: string[]) => refs.map((ref) => factMap.get(ref)?.text ?? "").join(" ");
  /** V1.2B: researched tickers whose on-demand pack is present. */
  const onDemandSymbols = selection.detectedTickers.filter((ticker) =>
    facts.some((fact) => fact.id.startsWith(`ticker.${ticker}.`)),
  );
  const units = collectUnits(answer);

  for (const unit of units) {
    for (const ref of unit.refs) {
      if (!factMap.has(ref)) {
        issues.push(
          issue(
            "UNKNOWN_EVIDENCE_REF",
            unit.path,
            `Evidence ref "${ref}" is unknown or outside the selected pack.`,
          ),
        );
      }
    }
  }

  if (answer.status === "answered") {
    if (answer.answer.evidenceRefs.length === 0) {
      issues.push(
        issue("MISSING_EVIDENCE_REFS", "answer.answer", "answered answers must cite evidence."),
      );
    }
    answer.supportingPoints.forEach((point, i) => {
      if (point.evidenceRefs.length === 0) {
        issues.push(
          issue(
            "MISSING_EVIDENCE_REFS",
            `answer.supportingPoints[${i}]`,
            "Answered supporting points must cite evidence.",
          ),
        );
      }
    });
  }

  for (const unit of units) {
    const surface = surfaceOf(unit.refs);
    const missing = unsupportedNumbers(unit.text, surface);
    if (missing.length > 0) {
      issues.push(
        issue(
          "UNSUPPORTED_NUMBER",
          unit.path,
          `Exact numbers not present in referenced evidence: ${missing.join(", ")}.`,
        ),
      );
    }
    if (ABSOLUTE_CAUSALITY.test(unit.text)) {
      issues.push(
        issue(
          "ABSOLUTE_CAUSALITY",
          unit.path,
          "Causal language is not allowed; use contextual language like 'matched evidence points to'.",
        ),
      );
    }
    if (inventedFutureEvent(unit.text, surface)) {
      issues.push(
        issue(
          "UNSUPPORTED_FUTURE_EVENT",
          unit.path,
          "Invented scheduled future event is not supported by evidence.",
        ),
      );
    }
  }

  if (answer.status === "out_of_scope") {
    const allowedBoilerplate = /grounded market evidence|Market War Room/i;
    const prose = allProse(answer).join(" ");
    if (answer.supportingPoints.length !== 0 || answer.answer.evidenceRefs.length !== 0) {
      issues.push(
        issue(
          "OUT_OF_SCOPE_CONTENT",
          "answer",
          "out_of_scope answers must be procedural with no evidence refs or supporting points.",
        ),
      );
    }
    if (!allowedBoilerplate.test(prose)) {
      issues.push(
        issue(
          "OUT_OF_SCOPE_CONTENT",
          "answer",
          "out_of_scope answers must only state the grounded-evidence limitation.",
        ),
      );
    }
  }

  for (const unit of units) {
    const catalystRefs = unit.refs.filter((ref) => ref.startsWith("catalyst."));
    const unitTickers = mentionedTickers(unit.text, symbols);
    for (const ref of catalystRefs) {
      const refTicker = ref.split(".")[1]?.toUpperCase();
      if (refTicker && unitTickers.length > 0 && !unitTickers.includes(refTicker)) {
        issues.push(
          issue(
            "CROSS_TICKER_CATALYST_REF",
            unit.path,
            `Catalyst ref "${ref}" does not match the tickers discussed in the text.`,
          ),
        );
      }
      // V1.2B: an on-demand ticker pack must never cite another company's
      // catalyst evidence, even when both names appear in the sentence.
      if (
        refTicker &&
        onDemandSymbols.length > 0 &&
        !selection.detectedTickers.includes(refTicker)
      ) {
        issues.push(
          issue(
            "CROSS_TICKER_CATALYST_REF",
            unit.path,
            `Catalyst ref "${ref}" belongs to another company than the researched ticker.`,
          ),
        );
      }
      const fact = factMap.get(ref);
      const strength = strengthOf(fact);
      if (
        strength &&
        strength !== "strong" &&
        /\bstrong(?:ly)? evidence\b|\bconfirmed cause\b/i.test(unit.text)
      ) {
        issues.push(
          issue(
            "CATALYST_STRENGTH_OVERSTATEMENT",
            unit.path,
            `Language overstates a ${strength} catalyst.`,
          ),
        );
      }
    }

    // A question scoped to ticker(s) must not answer with another ticker's catalyst only.
    if (selection.selectionMode === "ticker_scoped" && unitTickers.length > 0) {
      for (const scopeTicker of selection.detectedTickers) {
        if (!unitTickers.includes(scopeTicker)) continue;
        const catalystRefsForScope = catalystRefs.some(
          (ref) => ref.split(".")[1]?.toUpperCase() === scopeTicker,
        );
        if (
          catalystRefs.length > 0 &&
          !catalystRefsForScope &&
          factMap.has(`catalyst.${scopeTicker}.primary`)
        ) {
          issues.push(
            issue(
              "CROSS_TICKER_CATALYST_REF",
              unit.path,
              `Question scoped to ${scopeTicker} cannot be answered only with another ticker's catalyst.`,
            ),
          );
        }
      }
    }

    for (const ticker of unitTickers) {
      const hasNone = hasNoneCatalyst(factMap, ticker);
      if (hasNone && eventLanguage(unit.text) && !NO_CATALYST_ALLOWED.test(unit.text)) {
        issues.push(
          issue(
            "NO_CLEAR_CATALYST_CONTRADICTION",
            unit.path,
            `No company-specific catalyst was identified for ${ticker}; event attribution is invalid.`,
          ),
        );
      }
    }

    if (
      selection.selectionMode === "ticker_scoped" &&
      unit.path === "answer.answer" &&
      unitTickers.length > 0
    ) {
      for (const ticker of unitTickers) {
        const hasRelevant = unit.refs.some(
          (ref) => ref === `anomaly.${ticker}` || ref.startsWith(`catalyst.${ticker}.`),
        );
        if (!hasRelevant && factMap.has(`anomaly.${ticker}`)) {
          issues.push(
            issue(
              "MISSING_TICKER_EVIDENCE",
              unit.path,
              `Answer discusses ${ticker} but does not cite its anomaly/catalyst evidence.`,
            ),
          );
        }
      }
    }

    // V1.2B: on-demand ticker packs must be grounded in that ticker's own
    // evidence, keep contextual events unpromoted, and never assert a forecast.
    const isLimitationUnit = unit.path.startsWith("answer.limitations");
    for (const ticker of selection.detectedTickers) {
      const packHasTickerFacts = facts.some((fact) => fact.id.startsWith(`ticker.${ticker}.`));
      if (!packHasTickerFacts || !unitTickers.includes(ticker) || isLimitationUnit) continue;
      const hasRelevant = unit.refs.some(
        (ref) =>
          ref.startsWith(`ticker.${ticker}.`) ||
          ref === `anomaly.${ticker}` ||
          ref.startsWith(`catalyst.${ticker}.`),
      );
      if (!hasRelevant) {
        issues.push(
          issue(
            "TICKER_EVIDENCE_MISMATCH",
            unit.path,
            `Answer discusses ${ticker} but cites no ${ticker} evidence from the selected on-demand pack.`,
          ),
        );
      }
      const citesContextual = unit.refs.some((ref) => isContextOnlyTickerRef(ref, ticker));
      const hasValidatedCatalyst = factMap.has(`catalyst.${ticker}.primary`);
      if (citesContextual && !hasValidatedCatalyst && CATALYST_PROMOTION.test(unit.text)) {
        issues.push(
          issue(
            "CONTEXT_ONLY_CATALYST_PROMOTION",
            unit.path,
            `News/SEC evidence for ${ticker} is contextual only and cannot be presented as the cause of the move.`,
          ),
        );
      }
    }
    if (assertedForecast(unit.text)) {
      issues.push(
        issue(
          "UNSUPPORTED_FORECAST",
          unit.path,
          "Future price direction, price targets or probabilities must not be asserted.",
        ),
      );
    }
  }

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}
