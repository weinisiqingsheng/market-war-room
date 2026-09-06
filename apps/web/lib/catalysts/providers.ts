import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { alpacaFetch } from "@/lib/market-data/providers/alpaca-http";
import { canonicalToAlpaca } from "@/lib/breadth/symbols";
import type { BreadthCredentials } from "@/lib/breadth/provider";
import { inCatalystWindow, type CatalystWindow } from "./time-window";
import type { CorporateActionEvidence, NewsArticle, SecFiling } from "./types";

/** Max concurrent SEC requests (fair-access conservative). */
export const SEC_MAX_CONCURRENCY = 3;

interface AlpacaNewsRaw {
  id?: string;
  headline?: string;
  summary?: string;
  source?: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
  symbols?: string[];
  url?: string;
}

interface AlpacaNewsResponse {
  news?: AlpacaNewsRaw[];
  next_page_token?: string | null;
}

/** Alpaca News — delayed entitlement; normalized minimal fields only. */
export async function fetchAlpacaNews(
  creds: BreadthCredentials,
  symbols: string[],
  window: CatalystWindow,
): Promise<{ articles: NewsArticle[]; ok: boolean }> {
  const requestSymbols = symbols.map(canonicalToAlpaca);
  const merged: NewsArticle[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 3; page += 1) {
    const params = new URLSearchParams({
      symbols: requestSymbols.join(","),
      start: window.startIso,
      limit: "50",
      include_content: "false",
    });
    if (window.cutoffIso) params.set("end", window.cutoffIso);
    if (pageToken) params.set("page_token", pageToken);
    const payload = (await alpacaFetch({
      baseUrl: creds.dataBaseUrl,
      path: `/v1beta1/news?${params.toString()}`,
      apiKeyId: creds.apiKeyId,
      apiSecretKey: creds.apiSecretKey,
      timeoutMs: creds.timeoutMs,
      fetchImpl: creds.fetchImpl,
    })) as AlpacaNewsResponse;
    if (!payload || !Array.isArray(payload.news)) break;
    for (const article of payload.news) {
      const publishedAt = article.created_at ?? "";
      if (!publishedAt || !inCatalystWindow(publishedAt, window)) continue;
      merged.push({
        id: String(article.id ?? publishedAt),
        headline: article.headline ?? "",
        summary: article.summary ?? "",
        source: article.source ?? "",
        author: article.author ?? null,
        createdAt: article.created_at ?? null,
        updatedAt: article.updated_at ?? null,
        publishedAt,
        symbols: Array.isArray(article.symbols) ? article.symbols.map(canonicalToAlpaca) : [],
        url: article.url ?? "",
      });
    }
    pageToken = typeof payload.next_page_token === "string" ? payload.next_page_token : null;
    if (!pageToken) break;
  }
  return { articles: merged, ok: true };
}

export interface SecClient {
  enabled: boolean;
  userAgent: string;
}

async function fetchSecCompany(client: SecClient, cik: string, signalMs: number): Promise<unknown> {
  if (!client.enabled) {
    throw new MarketDataError("config", "SEC disabled (no SEC_USER_AGENT)", 503, "sec");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), signalMs);
  try {
    const response = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`, {
      headers: { "User-Agent": client.userAgent, Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 403 || response.status === 429) {
      throw new MarketDataError("rate_limit", `SEC fair access (${response.status})`, response.status, "sec");
    }
    if (response.status >= 500) {
      throw new MarketDataError("server", `SEC error (${response.status})`, response.status, "sec");
    }
    if (!response.ok) {
      throw new MarketDataError("unknown", `SEC returned ${response.status}`, response.status, "sec");
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

interface SecRecentFilings {
  filings?: { recent?: { form?: string[]; filingDate?: string[]; acceptanceDateTime?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
}

export async function fetchSecSubmissions(
  client: SecClient,
  cik: string,
  ticker: string,
  window: CatalystWindow,
  timeoutMs: number,
): Promise<SecFiling[]> {
  const payload = (await fetchSecCompany(client, cik, timeoutMs)) as SecRecentFilings;
  const recent = payload?.filings?.recent;
  if (!recent) return [];
  const filings: SecFiling[] = [];
  const count = Math.min(recent.form?.length ?? 0, recent.accessionNumber?.length ?? 0);
  for (let i = 0; i < count; i += 1) {
    const form = recent.form?.[i] ?? "";
    const filingDate = recent.filingDate?.[i] ?? null;
    const accession = recent.accessionNumber?.[i] ?? "";
    const primaryDocument = recent.primaryDocument?.[i] ?? "";
    if (!form || !accession) continue;
    const publishedAt = `${filingDate ?? "1970-01-01"}T00:00:00Z`;
    if (!inCatalystWindow(publishedAt, window)) continue;
    const accNoDashes = accession.replace(/-/g, "");
    filings.push({
      cik,
      ticker,
      form,
      filingDate,
      acceptanceDateTime: recent.acceptanceDateTime?.[i] ?? null,
      accessionNumber: accession,
      primaryDocument,
      filingUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}/${primaryDocument}`,
    });
  }
  return filings;
}

interface CorpActionRaw {
  symbol?: string;
  type?: string;
  date?: string;
  title?: string;
}

/** Alpaca Corporate Actions — supplemental evidence; never blocks the module. */
export async function fetchCorporateActions(
  creds: BreadthCredentials,
  symbols: string[],
  window: CatalystWindow,
): Promise<CorporateActionEvidence[]> {
  const params = new URLSearchParams({
    symbols: symbols.map(canonicalToAlpaca).join(","),
    start: window.startIso,
  });
  const payload = (await alpacaFetch({
    baseUrl: creds.dataBaseUrl,
    path: `/v2/corporate_actions?${params.toString()}`,
    apiKeyId: creds.apiKeyId,
    apiSecretKey: creds.apiSecretKey,
    timeoutMs: creds.timeoutMs,
    fetchImpl: creds.fetchImpl,
  })) as { corporate_actions?: CorpActionRaw[] };
  const actions = Array.isArray(payload?.corporate_actions) ? payload.corporate_actions : [];
  return actions
    .filter((action) => action.date === null || inCatalystWindow(`${action.date}T00:00:00Z`, window))
    .map((action) => ({
      ticker: canonicalToAlpaca(action.symbol ?? ""),
      type: action.type ?? "",
      date: action.date ?? null,
      description: action.title ?? "",
      url: "",
    }));
}
