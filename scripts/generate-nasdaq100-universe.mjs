#!/usr/bin/env node
/**
 * One-off offline generator for the versioned Nasdaq 100 anomaly universe.
 *
 * The app NEVER fetches constituents at runtime; this script materializes a
 * committed TS snapshot. Re-run to refresh the dataset and bump the version.
 *
 * Source (documented, verifiable, retrieval-time only):
 *   https://en.wikipedia.org/wiki/List_of_NASDAQ-100_companies (raw wikitext)
 *   The page mirrors the official Nasdaq-100 constituent list and carries the
 *   index provider's ICB industry + subsector columns.
 *
 * Normalization:
 * - Ticker uppercased, trimmed; the snapshot is share-class aware and keeps
 *   every listed security (the index contains 101 securities: 100 companies,
 *   with Alphabet represented by GOOGL + GOOG). Count is derived, never
 *   forced to 100.
 * - Sector: for symbols that also exist in the canonical S&P 500 snapshot the
 *   S&P 500 GICS sector is reused (identical sector-relative math for
 *   overlapping symbols — do not change this). Remaining symbols are mapped
 *   from the source's own ICB industry column with the documented
 *   ICB_TO_GICS table below.
 * - Name: wiki markup/links/refs stripped.
 *
 * Update procedure: re-run `node scripts/generate-nasdaq100-universe.mjs`,
 * run `npx prettier --write apps/web/lib/anomalies/universe/nasdaq100.ts`,
 * review the diff (constituent changes, count, asOf), then bump
 * NASDAQ100_UNIVERSE_VERSION if membership changed.
 */
import fs from "node:fs";

const SOURCE = "https://en.wikipedia.org/w/index.php?title=List_of_NASDAQ-100_companies&action=raw";
const SP500_FILE = "apps/web/lib/breadth/universe/sp500.ts";
const OUT = "apps/web/lib/anomalies/universe/nasdaq100.ts";

/** Documented ICB industry (source column) → GICS sector used by sector-map.ts. */
const ICB_TO_GICS = {
  Technology: "Information Technology",
  "Consumer Discretionary": "Consumer Discretionary",
  "Health Care": "Health Care",
  Utilities: "Utilities",
  Industrials: "Industrials",
  Energy: "Energy",
  Telecommunications: "Communication Services",
  "Consumer Staples": "Consumer Staples",
  "Basic Materials": "Materials",
  Financials: "Financials",
  "Real Estate": "Real Estate",
};

const ALLOWED_GICS = new Set([
  "Information Technology",
  "Financials",
  "Energy",
  "Health Care",
  "Industrials",
  "Consumer Staples",
  "Consumer Discretionary",
  "Utilities",
  "Materials",
  "Real Estate",
  "Communication Services",
]);

function stripWiki(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSp500Sectors() {
  const text = fs.readFileSync(SP500_FILE, "utf8");
  const map = new Map();
  const rowRe = /\{ ticker: "([^"]+)", name: "([^"]*)", sector: "([^"]*)", cik: "([^"]*)" \}/g;
  for (const match of text.matchAll(rowRe)) {
    map.set(match[1], { name: match[2], sector: match[3] });
  }
  if (map.size === 0) throw new Error("could not parse canonical S&P 500 snapshot");
  return map;
}

async function main() {
  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "MarketWarRoom-universe-generator" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const asOf = new Date().toISOString().slice(0, 10);
  const sp500 = parseSp500Sectors();

  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*([A-Z][A-Z0-9.\-]*)\s*\|\|\s*(.+?)\s*\|\|\s*(.+?)\s*\|\|\s*(.+?)\s*$/,
    );
    if (!match) continue;
    const ticker = match[1].trim();
    const name = stripWiki(match[2]);
    const icb = stripWiki(match[3]);
    const canonical = sp500.get(ticker);
    const sector = canonical ? canonical.sector : ICB_TO_GICS[icb];
    if (!sector || !ALLOWED_GICS.has(sector)) {
      throw new Error(`unmapped sector for ${ticker}: icb="${icb}"`);
    }
    rows.push({
      ticker,
      name: canonical ? canonical.name : name,
      sector,
      sectorSource: canonical ? "sp500" : "icb",
    });
  }

  if (rows.length === 0) throw new Error("no constituents parsed from source");
  if (new Set(rows.map((row) => row.ticker)).size !== rows.length) {
    throw new Error("duplicate tickers in source data");
  }
  const icbDerived = rows.filter((row) => row.sectorSource === "icb").length;
  const lines = [
    "/**",
    " * Nasdaq 100 constituent universe — version-controlled, static (V1.1E).",
    " *",
    " * OFFLINE SNAPSHOT — generated once by",
    " * `scripts/generate-nasdaq100-universe.mjs`; never scraped at runtime.",
    " *",
    ` * Source: ${SOURCE}`,
    ` * Retrieval date: ${asOf}`,
    " * Normalization: tickers uppercased/trimmed; wiki markup stripped from names;",
    " * share classes kept as separate securities (the index lists 101 securities —",
    " * GOOGL and GOOG share one company); count is derived from this snapshot.",
    " * Sector: GICS sector reused from the canonical S&P 500 snapshot for symbols",
    " * present there (guarantees identical sector-relative anomaly math for",
    " * overlapping symbols); remaining symbols normalized from the source's own",
    " * ICB industry column via the documented ICB→GICS table in the generator.",
    " *",
    " * Known limitation: ICB industry and GICS sector are different taxonomies, so",
    ` * ${icbDerived} non-overlapping names use the normalized ICB bucket.`,
    " *",
    " * Update procedure: re-run the generator, review the diff (membership, count,",
    " * asOf) and bump NASDAQ100_UNIVERSE_VERSION when membership changes.",
    " */",
    'import type { AnomalyUniverseDefinition } from "./types";',
    "",
    "/** Version identifier for the static constituent set (regenerate → bump). */",
    'export const NASDAQ100_UNIVERSE_VERSION = "nasdaq100-v1";',
    "",
    "export const nasdaq100AnomalyUniverse: AnomalyUniverseDefinition = {",
    '  id: "nasdaq100",',
    '  label: "Nasdaq 100",',
    "  version: NASDAQ100_UNIVERSE_VERSION,",
    `  asOf: ${JSON.stringify(asOf)},`,
    `  count: ${rows.length},`,
    "  symbols: [",
    ...rows.map((row) => `    ${JSON.stringify(row.ticker)},`),
    "  ],",
    "  members: [",
    ...rows.map(
      (row) =>
        `    { ticker: ${JSON.stringify(row.ticker)}, name: ${JSON.stringify(row.name)}, sector: ${JSON.stringify(row.sector)}, sectorSource: ${JSON.stringify(row.sectorSource)} },`,
    ),
    "  ],",
    `  source: ${JSON.stringify(`${SOURCE} (retrieved ${asOf})`)},`,
    "};",
    "",
  ];

  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(`wrote ${rows.length} members (${icbDerived} ICB-normalized) -> ${OUT}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
