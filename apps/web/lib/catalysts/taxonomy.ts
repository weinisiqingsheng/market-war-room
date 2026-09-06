/**
 * Deterministic catalyst classification (catalyst-match-v1).
 *
 * Conservative keyword classification with explicit precedence. Never infers
 * more than the text supports; polarity only when language is explicit.
 */
import type { CatalystCategory, EventPolarity } from "./types";

interface Rule {
  category: CatalystCategory;
  patterns: RegExp[];
}

// Precedence: first matching rule wins (ordered list).
const RULES: Rule[] = [
  {
    category: "M&A / STRATEGIC",
    patterns: [/\b(acqui(re|sition|ring))\b/i, /\bmerger\b/i, /\btakeover\b/i, /\bbuyout\b/i, /\bstrategic alternatives\b/i, /\bstock and cash merger\b/i],
  },
  {
    category: "REGULATORY / LEGAL",
    patterns: [/\b(FDA|FTC|DOJ|SEC|FHFA)\b/i, /\binvestigation\b/i, /\blawsuit\b/i, /\bcourt\b/i, /\bapproval\b/i, /\brejection\b/i, /\bregulatory\b/i, /\bregulator(y|ies)?\b/i],
  },
  {
    category: "FINANCING / OFFERING",
    patterns: [/\boffering\b/i, /\bconvertible\b/i, /\bdebt offering\b/i, /\bATM\b/i, /\bshare offering\b/i, /\bsecondary offering\b/i],
  },
  {
    category: "CAPITAL RETURN",
    patterns: [/\bbuyback\b/i, /\brepurchase\b/i, /\bdividend\b/i],
  },
  {
    category: "GUIDANCE",
    patterns: [/\bguidance\b/i, /\boutlook\b/i, /\bforecast\b/i, /\braises guidance\b/i, /\bcuts guidance\b/i],
  },
  {
    category: "ANALYST ACTION",
    patterns: [/\bupgrad(e|es|ed)?\b/i, /\bdowngrad(e|es|ed)?\b/i, /\bprice target\b/i, /\binitiates coverage\b/i, /\boverweight\b/i, /\bunderweight\b/i, /\bneutral rating\b/i],
  },
  {
    category: "EARNINGS",
    patterns: [/\bearnings\b/i, /\bEPS\b/i, /\bquarterly results\b/i, /\brevenue\b/i, /\breports Q[1-4]\b/i, /\bnet income\b/i],
  },
  {
    category: "PRODUCT / CONTRACT",
    patterns: [/\blaunch\b/i, /\bcontract\b/i, /\baward\b/i, /\bpartnership\b/i, /\border\b/i],
  },
  {
    category: "MANAGEMENT",
    patterns: [/\bCEO\b/i, /\bCFO\b/i, /\bresigns\b/i, /\bsteps down\b/i, /\bappoints\b/i, /\bleadership\b/i],
  },
];

export function classifyNews(text: string): CatalystCategory {
  const haystack = ` ${text} `;
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) return rule.category;
  }
  return "OTHER";
}

const POLARITY_PATTERNS: Array<[EventPolarity, RegExp]> = [
  ["positive", /\bupgraded\b/i],
  ["negative", /\bdowngraded\b/i],
  ["positive", /\braises guidance\b/i],
  ["positive", /\braised (its )?outlook\b/i],
  ["negative", /\bcuts guidance\b/i],
  ["negative", /\bcuts (its )?outlook\b/i],
  ["positive", /\bFDA approves\b/i],
  ["negative", /\bFDA rejects\b/i],
  ["positive", /\bapproved by\b/i],
  ["negative", /\brejected\b/i],
];

export function classifyPolarity(text: string): EventPolarity {
  const haystack = ` ${text} `;
  for (const [polarity, pattern] of POLARITY_PATTERNS) {
    if (pattern.test(haystack)) return polarity;
  }
  return "unknown";
}

/** Deterministic mapping of SEC form → catalyst category (conservative). */
export function classifySecForm(form: string): CatalystCategory {
  const f = form.toUpperCase();
  if (f === "10-Q" || f === "10-K") return "SEC FILING";
  if (f === "8-K" || f === "6-K") return "SEC FILING";
  if (f.startsWith("424B") || f.startsWith("S-3") || f === "S-1") return "FINANCING / OFFERING";
  if (f.startsWith("SC 13")) return "SEC FILING";
  if (f === "4") return "SEC FILING";
  return "SEC FILING";
}

/** SEC-form display labels used in evidence summaries. */
export function secFormLabel(form: string): string {
  const f = form.toUpperCase();
  if (f === "10-Q" || f === "10-K") return "PERIODIC REPORT";
  if (f === "8-K" || f === "6-K") return "MATERIAL FILING";
  if (f.startsWith("424B") || f.startsWith("S-3") || f === "S-1") return "FINANCING / OFFERING";
  if (f.startsWith("SC 13")) return "OWNERSHIP FILING";
  if (f === "4") return "INSIDER FILING";
  return "SEC FILING";
}
