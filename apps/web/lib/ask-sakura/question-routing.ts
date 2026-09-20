/**
 * Deterministic question routing (V1.2B). Pure: no LLM, no network, no clock.
 *
 * The router only decides WHICH evidence path to take; the grounded prompt and
 * grounding validator retain final authority over the answer. DeepSeek is never
 * used to recognise a ticker.
 *
 * Outcomes:
 * - GLOBAL_MARKET:   symbols already present in the BriefContext, or no ticker
 *                    candidates at all → existing V1.1C path unchanged.
 * - TICKER_RESEARCH: exactly one plausible symbol that the global pack does not
 *                    contain → on-demand ticker-context-v1 research.
 * - AMBIGUOUS:       two or more distinct unknown symbols → honest
 *                    clarification instead of silently picking one.
 * - OUT_OF_SCOPE:    clearly non-market question (advisory hint; the existing
 *                    prompt policy still produces the final out_of_scope answer).
 */
import type { BriefContext } from "@/lib/ai-brief/types";

export type AskRoute = "GLOBAL_MARKET" | "TICKER_RESEARCH" | "AMBIGUOUS" | "OUT_OF_SCOPE";

export interface AskRoutingResult {
  route: AskRoute;
  /** Distinct unknown-but-plausible symbols, in order of appearance. */
  tickerSymbols: string[];
  /** Candidate symbols that the global evidence pack already covers. */
  globalSymbolsMatched: string[];
  reason:
    | "global_symbol_in_pack"
    | "no_ticker_candidate"
    | "single_external_symbol"
    | "multiple_external_symbols"
    | "non_market_topic";
}

/**
 * Tokens that look like tickers but are not treated as securities. Deliberately
 * small and high-precision: only market-wide acronyms and question words.
 */
const STOPWORDS = new Set([
  "WHY",
  "WHAT",
  "WHEN",
  "WHERE",
  "WHO",
  "HOW",
  "IS",
  "ARE",
  "WAS",
  "WERE",
  "THE",
  "AND",
  "FOR",
  "WILL",
  "CAN",
  "COULD",
  "SHOULD",
  "WOULD",
  "DO",
  "DOES",
  "DID",
  "MEAN",
  "MEANS",
  "TODAY",
  "TOMORROW",
  "WEEK",
  "MONTH",
  "YEAR",
  "NOW",
  "AGAIN",
  "ABOUT",
  "WITH",
  "FROM",
  "INTO",
  "USA",
  "US",
  "UK",
  "EU",
  "USD",
  "EUR",
  "JPY",
  "CNY",
  "AI",
  "CPI",
  "PPI",
  "PCE",
  "GDP",
  "EPS",
  "FOMC",
  "FED",
  "SEC",
  "FDIC",
  "IRS",
  "DOJ",
  "FTC",
  "FDA",
  "ECB",
  "BOJ",
  "OPEC",
  "NATO",
  "ETF",
  "IPO",
  "CEO",
  "CFO",
  "COO",
  "CTO",
  "YOY",
  "QOQ",
  "MOM",
  "RSI",
  "PE",
  "PB",
  "EV",
  "YTD",
  "EOD",
  "ET",
  "UTC",
  "AM",
  "PM",
  "OK",
  "FAQ",
  "API",
  "JSON",
  "HTTP",
  "LLM",
  "TBD",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  /* All-caps market/English words that must never be treated as securities. */
  "MARKET",
  "MARKETS",
  "STOCK",
  "STOCKS",
  "BREADTH",
  "PRICE",
  "PRICES",
  "NEWS",
  "RALLY",
  "SELLOFF",
  "UP",
  "DOWN",
  "HIGH",
  "LOW",
  "OPEN",
  "CLOSE",
  "VOLUME",
  "TRADE",
  "TRADING",
  "INDEX",
  "INDICES",
  "RATES",
  "RATE",
  "RISK",
  "BOND",
  "BONDS",
  "YIELD",
  "YIELDS",
  "DOLLAR",
  "GOLD",
  "OIL",
  "TECH",
  "EARNINGS",
  "GROWTH",
  "VALUE",
  "DATA",
  "REPORT",
  "FILING",
  "MACRO",
  "INFLATION",
  "RECESSION",
  "SECTOR",
  "SECTORS",
  "REGIME",
  "CATALYST",
  "CATALYSTS",
  "CHART",
]);

/** High-precision, non-market topic markers (advisory routing hint only). */
const NON_MARKET_PATTERNS = [
  /\b(poem|poetry|haiku|joke|recipe|weather|sports?|football|basketball|movie|song|lyrics)\b/i,
  /\b(who (?:is|was) the president|capital of|translate|write me|tell me a story)\b/i,
];

/** `$SYMBOL` (any case) or an ALL-CAPS token of 2–10 chars. */
const DOLLAR_SYMBOL = /\$([A-Za-z][A-Za-z0-9.\-]{0,9})/g;
const CAPS_SYMBOL = /\b([A-Z][A-Z0-9.\-]{1,9})\b/g;

function normalizeToken(token: string): string {
  return token.replace(/[.-]+$/, "").toUpperCase();
}

/** Symbols already covered by the global BriefContext pack. */
export function globalSymbolsOf(context: BriefContext): Set<string> {
  const symbols = new Set<string>();
  for (const fact of context.evidence) {
    const parts = fact.id.split(".");
    const prefix = parts[0] ?? "";
    const key = parts[1] ?? "";
    if (prefix === "anomaly" || prefix === "catalyst" || prefix === "sector") {
      if (/^[A-Z][A-Z0-9.-]{0,9}$/i.test(key)) symbols.add(key.toUpperCase());
    }
    if (prefix === "market" && /^[A-Z0-9-]{1,10}$/i.test(key)) symbols.add(key.toUpperCase());
  }
  return symbols;
}

function collectCandidates(question: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const token = normalizeToken(raw);
    if (token.length < 2 || STOPWORDS.has(token) || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  };
  for (const match of question.matchAll(DOLLAR_SYMBOL)) push(match[1] ?? "");
  for (const match of question.matchAll(CAPS_SYMBOL)) push(match[1] ?? "");
  return out;
}

export function routeAskQuestion(context: BriefContext, question: string): AskRoutingResult {
  const candidates = collectCandidates(question);
  const globalSymbols = globalSymbolsOf(context);
  const globalSymbolsMatched = candidates.filter((token) => globalSymbols.has(token));
  const external = candidates.filter((token) => !globalSymbols.has(token));

  if (external.length > 1) {
    return {
      route: "AMBIGUOUS",
      tickerSymbols: external,
      globalSymbolsMatched,
      reason: "multiple_external_symbols",
    };
  }
  if (external.length === 1) {
    return {
      route: "TICKER_RESEARCH",
      tickerSymbols: external,
      globalSymbolsMatched,
      reason: "single_external_symbol",
    };
  }
  if (globalSymbolsMatched.length > 0) {
    return {
      route: "GLOBAL_MARKET",
      tickerSymbols: [],
      globalSymbolsMatched,
      reason: "global_symbol_in_pack",
    };
  }
  if (NON_MARKET_PATTERNS.some((pattern) => pattern.test(question))) {
    return {
      route: "OUT_OF_SCOPE",
      tickerSymbols: [],
      globalSymbolsMatched: [],
      reason: "non_market_topic",
    };
  }
  return {
    route: "GLOBAL_MARKET",
    tickerSymbols: [],
    globalSymbolsMatched: [],
    reason: "no_ticker_candidate",
  };
}
