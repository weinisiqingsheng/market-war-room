/**
 * catalyst-match-v1 — deterministic deduplication, relevance, evidence
 * strength, and directional alignment.
 */
import { classifyNews, classifyPolarity, secFormLabel } from "./taxonomy";
import { extractCandidateEvidence } from "./candidate-evidence";
import type { CatalystWindow } from "./time-window";
import type {
  Alignment,
  CatalystCategory,
  CatalystItem,
  CatalystMatch,
  CorporateActionEvidence,
  EvidenceStrength,
  EventPolarity,
  NewsArticle,
  SecFiling,
} from "./types";

/** Deduplicate by provider article id, then by normalized headline/url. */
export function dedupeArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const article of articles) {
    const headlineKey = headlineKeyOf(article.headline);
    const key = article.id || `${article.source}::${headlineKey}::${article.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(article);
  }
  return out;
}

function headlineKeyOf(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function headlineKey(text: string): string {
  return headlineKeyOf(text);
}

export function symbolSpecificity(symbols: string[], ticker: string): number {
  const related = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  related.delete(ticker.toUpperCase());
  const count = related.size;
  if (count === 0) return 100;
  if (count <= 2) return 75;
  if (count <= 9) return 45;
  return 20;
}

export function temporalScore(publishedAt: string, window: CatalystWindow): number {
  const cutoff = window.cutoffIso;
  if (cutoff === null) return 100;
  const hours = (Date.parse(cutoff) - Date.parse(publishedAt)) / 3_600_000;
  if (hours <= 2) return 100;
  if (hours <= 8) return 85;
  if (hours <= 24) return 70;
  return 55;
}

const MATERIALITY: Record<CatalystCategory, number> = {
  EARNINGS: 100,
  GUIDANCE: 100,
  "M&A / STRATEGIC": 100,
  "REGULATORY / LEGAL": 100,
  "ANALYST ACTION": 80,
  "FINANCING / OFFERING": 80,
  "PRODUCT / CONTRACT": 80,
  MANAGEMENT: 65,
  "CAPITAL RETURN": 65,
  "CORPORATE ACTION": 65,
  "SEC FILING": 55,
  "MACRO / SECTOR": 20,
  OTHER: 40,
};

/** Contextual "candidate only appeared in a movers list" materiality — never high. */
const CONTEXTUAL_MATERIALITY = 15;

export function materiality(category: CatalystCategory, contextOnly = false): number {
  return contextOnly ? CONTEXTUAL_MATERIALITY : MATERIALITY[category];
}

/** Corroboration never counts duplicates (already deduped) as separate sources. */
export function corroborationScore(
  distinctNewsSources: number,
  hasOfficialEvidence: boolean,
  hasRelatedNews: boolean,
): number {
  if (hasOfficialEvidence && hasRelatedNews) return 100;
  if (distinctNewsSources >= 2 && hasRelatedNews) return 80;
  if (distinctNewsSources === 1 && hasRelatedNews) return 55;
  if (hasOfficialEvidence) return 55;
  return 25;
}

/** Relevance = 25% specificity + 25% temporal + 30% materiality + 20% corroboration. */
export function relevanceScore(input: {
  specificity: number;
  temporal: number;
  materiality: number;
  corroboration: number;
}): number {
  return 0.25 * input.specificity + 0.25 * input.temporal + 0.3 * input.materiality + 0.2 * input.corroboration;
}

export function evidenceStrength(relevance: number): EvidenceStrength {
  if (relevance >= 80) return "strong";
  if (relevance >= 65) return "moderate";
  return "weak";
}

export function alignPolarity(directionUp: boolean, polarity: EventPolarity): Alignment {
  if (polarity === "positive") return directionUp ? "aligned" : "divergent";
  if (polarity === "negative") return directionUp ? "divergent" : "aligned";
  return "unknown";
}

/** Build a CatalystMatch from a news article for one candidate (candidate-conditioned). */
export function matchNews(
  ticker: string,
  companyName: string,
  article: NewsArticle,
  window: CatalystWindow,
  distinctNewsSources: number,
): CatalystMatch {
  const evidence = extractCandidateEvidence({
    ticker,
    companyName,
    headline: article.headline,
    summary: article.summary,
    symbols: article.symbols,
  });
  // Context-only movers mentions never inherit another company's category.
  const category = evidence.contextOnly ? "OTHER" : evidence.specific ? classifyNews(evidence.text) : "OTHER";
  const textForPolarity = evidence.contextOnly ? "" : evidence.text;
  // A bare "in the movers list" mention is not corroborating evidence.
  const corroboration = evidence.contextOnly ? 0 : corroborationScore(distinctNewsSources, false, true);
  const relevance = relevanceScore({
    specificity: symbolSpecificity(article.symbols, ticker),
    temporal: temporalScore(article.publishedAt, window),
    materiality: materiality(category, evidence.contextOnly),
    corroboration,
  });
  return {
    category,
    headline: article.headline,
    publishedAt: article.publishedAt,
    source: article.source,
    sourceType: "news",
    url: article.url,
    relevanceScore: Math.round(relevance),
    evidenceStrength: evidenceStrength(relevance),
    eventPolarity: classifyPolarity(textForPolarity),
    symbols: article.symbols,
    supportingEvidence: evidence.sentences,
  };
}

/** Build a CatalystMatch from a related SEC filing. */
export function matchFiling(filing: SecFiling): CatalystMatch {
  const relevance = relevanceScore({
    specificity: 100,
    temporal: 100,
    materiality: materiality("SEC FILING"),
    corroboration: corroborationScore(0, true, false),
  });
  return {
    category: "SEC FILING",
    headline: `${filing.form} — ${secFormLabel(filing.form)}`,
    publishedAt: filing.filingDate ? `${filing.filingDate}T00:00:00Z` : null,
    source: "SEC EDGAR",
    sourceType: "sec_filing",
    url: filing.filingUrl,
    relevanceScore: Math.round(relevance),
    evidenceStrength: evidenceStrength(relevance),
    eventPolarity: "unknown",
    symbols: [filing.ticker],
    supportingEvidence: [secFormLabel(filing.form)],
  };
}

/** Assemble the final per-ticker CatalystItem from gathered evidence. */
export function buildCatalystItem(input: {
  ticker: string;
  name: string;
  movePct: number;
  anomalyScore: number;
  anomalySeverity: string;
  directionUp: boolean;
  news: NewsArticle[];
  filings: SecFiling[];
  actions: CorporateActionEvidence[];
  window: CatalystWindow;
}): CatalystItem {
  const { ticker, name, movePct, anomalyScore, anomalySeverity, directionUp, news, filings, actions, window } = input;
  const distinctNewsSources = new Set(news.map((article) => article.source)).size;

  const candidates: CatalystMatch[] = [
    ...news.map((article) => matchNews(ticker, name, article, window, distinctNewsSources)),
    ...filings.map(matchFiling),
  ].sort((a, b) => b.relevanceScore - a.relevanceScore || (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""));

  const primary = candidates.find((candidate) => candidate.relevanceScore >= 50) ?? null;
  const secondary = candidates.filter((candidate) => candidate.relevanceScore >= 50).slice(1, 4);

  return {
    ticker,
    name,
    movePct,
    anomalyScore,
    anomalySeverity,
    status: primary ? "MATCHED" : "NO CLEAR CATALYST FOUND",
    primaryCatalyst: primary,
    secondaryCatalysts: secondary,
    alignment: primary ? alignPolarity(directionUp, primary.eventPolarity) : "unknown",
    catalystCutoff: window.cutoffIso,
    evidence: { newsCount: news.length, filingCount: filings.length, corporateActionCount: actions.length },
  };
}
