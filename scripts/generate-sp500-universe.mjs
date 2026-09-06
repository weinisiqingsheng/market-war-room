#!/usr/bin/env node
/**
 * One-off offline generator for the static S&P 500 universe file.
 *
 * The app NEVER fetches constituents at runtime; this script materializes a
 * versioned, version-controlled TS module. Re-run to refresh the dataset.
 */
import fs from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";
const OUT = "apps/web/lib/breadth/universe/sp500.ts";

function parseRow(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function loadCikMap() {
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": "MarketWarRoom-universe-generator" },
  });
  if (!res.ok) throw new Error(`SEC company_tickers HTTP ${res.status}`);
  const json = await res.json();
  const map = new Map();
  for (const entry of Object.values(json)) {
    if (entry && typeof entry.cik_str === "number" && typeof entry.ticker === "string") {
      map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
    }
  }
  return map;
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rows = text.trim().split(/\r?\n/).slice(1).map(parseRow);
  const cikByTicker = await loadCikMap();

  const members = rows
    .map((row) => ({
      ticker: row[0]?.trim().toUpperCase() ?? "",
      name: row[1]?.trim() ?? "",
      sector: row[2]?.trim() ?? "",
      cik: cikByTicker.get(row[0]?.trim().toUpperCase() ?? "") ?? "",
    }))
    .filter((member) => member.ticker.length > 0);

  if (new Set(members.map((member) => member.ticker)).size !== members.length) {
    throw new Error("duplicate tickers in source data");
  }

  const asOf = new Date().toISOString().slice(0, 10);
  const lines = [
    "/**",
    " * S&P 500 constituent universe — version-controlled, static (V1).",
    " *",
    " * WHY S&P 500: breadth is measured on the S&P 500 — the benchmark behind the",
    " * Market Pulse index set (SPY). The list is a canonical, versioned dataset",
    " * that is NEVER scraped at runtime. Sector is the GICS sector captured during",
    " * the same offline generation (used for sector-relative anomaly comparisons).",
    " *",
    " * The S&P 500 contains 503 symbols because a few companies list multiple",
    " * share classes (e.g. BRK.B). The canonical list is preserved as-is instead",
    " * of being force-rounded to exactly 500 rows.",
    " */",
    "export interface Sp500Member {",
    "  ticker: string;",
    "  name: string;",
    "  sector: string;",
    "  cik: string;",
    "}",
    "",
    "export interface Sp500Universe {",
    '  name: "S&P 500";',
    "  version: string;",
    "  asOf: string;",
    "  count: number;",
    "  members: Sp500Member[];",
    "}",
    "",
    "/** Version identifier for the static constituent set (regenerate → bump). */",
    'export const SP500_UNIVERSE_VERSION = "sp500-v1";',
    "",
    "export const sp500Universe: Sp500Universe = {",
    '  name: "S&P 500",',
    "  version: SP500_UNIVERSE_VERSION,",
    `  asOf: "${asOf}",`,
    `  count: ${members.length},`,
    "  members: [",
    ...members.map(
      (member) =>
        `    { ticker: ${JSON.stringify(member.ticker)}, name: ${JSON.stringify(member.name)}, sector: ${JSON.stringify(member.sector)}, cik: ${JSON.stringify(member.cik)} },`,
    ),
    "  ],",
    "};",
    "",
  ];

  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(`wrote ${members.length} members -> ${OUT}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
