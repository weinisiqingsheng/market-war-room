/**
 * Candidate-conditioned evidence extraction (catalyst-match-v1).
 *
 * Classification/materiality must be attributable to the CANDIDATE, not merely
 * present somewhere in a multi-symbol article. This module deterministically
 * isolates sentences/clauses that reference the candidate (ticker or company
 * name) and marks whether the candidate text is only a "movers list" mention.
 */
export interface CandidateRelevantEvidence {
  /** Candidate-attributable text (sentences/clauses mentioning the candidate). */
  text: string;
  /** True when explicit candidate attribution was found (or article is single-symbol). */
  specific: boolean;
  /** True when the candidate text only says the name moved (contextual only). */
  contextOnly: boolean;
  /** Candidate-specific supporting sentences (never unrelated-company text). */
  sentences: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasMention(text: string, ticker: string, companyName: string): boolean {
  const haystack = text.toLowerCase();
  const tickerPattern = new RegExp(`\\b${escapeRegExp(ticker.toLowerCase())}\\b`);
  if (tickerPattern.test(haystack)) return true;
  const name = companyName?.toLowerCase();
  if (!name || name.length <= 2) return false;
  if (haystack.includes(name)) return true;
  // Significant proper-noun tokens of the company name (length >= 4).
  const tokens = companyName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
  return tokens.some((token) => new RegExp(`\\b${escapeRegExp(token.toLowerCase())}\\b`).test(haystack));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Segment a sentence into chunks, tagging causal connectors (kept at the start
 * of each following chunk). Non-causal separators (while/with/comma) break the
 * chain so one company's complement cannot bleed into a previous candidate.
 */
const CAUSAL_CONNECTOR_RE =
  /\s+(after\s+(?:news|reports|announcement|the)\s+that|after|because of|because|as|amid|following|due to|on)\s+/gi;
const BREAK_CONNECTOR_RE = /\s+(while|whereas|with|and stocks)\s+|[;,]/gi;

interface Segment {
  text: string;
  causal: boolean;
}

function splitSegments(sentence: string): Segment[] {
  const roleMarked = sentence.replace(
    /\bas\s+(?=(?:new |its |the )?(?:CEO|CFO|chairman|president|director|head|co-?CEO)\b)/gi,
    "\u0000AS\u0000",
  );
  const boundaries: Array<{ index: number; causal: boolean }> = [];
  const pushMatches = (pattern: RegExp, causal: boolean) => {
    for (const match of roleMarked.matchAll(pattern)) {
      const index = match.index ?? 0;
      const pos = match[0][0] === "," || match[0][0] === ";" ? index : index + match[0].search(/\S/);
      boundaries.push({ index: pos, causal });
    }
  };
  pushMatches(CAUSAL_CONNECTOR_RE, true);
  pushMatches(BREAK_CONNECTOR_RE, false);
  boundaries.sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let cursor = 0;
  let pendingCausal = false;
  for (const boundary of boundaries) {
    if (boundary.index <= cursor) continue;
    segments.push({ text: roleMarked.slice(cursor, boundary.index).trim(), causal: false });
    cursor = boundary.index;
    pendingCausal = boundary.causal;
  }
  const tail = roleMarked.slice(cursor).trim();
  if (tail) {
    segments.push({ text: tail.replace(/\u0000AS\u0000/g, "as "), causal: pendingCausal });
  } else if (pendingCausal && segments.length > 0) {
    // Causal connector consumed the remainder (no tail) — keep flag on the last segment.
    segments[segments.length - 1] = { ...segments[segments.length - 1], causal: true };
  }
  return segments
    .map((segment) => ({ text: segment.text.replace(/\u0000AS\u0000/g, "as ").trim(), causal: segment.causal }))
    .filter((segment) => segment.text.length > 0);
}

function mentionsOtherTicker(text: string, symbols: string[], ticker: string): boolean {
  if (!Array.isArray(symbols)) return false;
  return symbols.some(
    (symbol) => symbol.toUpperCase() !== ticker.toUpperCase() && new RegExp(`\\b${escapeRegExp(symbol.toUpperCase())}\\b`).test(text),
  );
}

const CONTEXT_PATTERN =
  /\b(moved|rose|fell|gained|declined|traded|jumped|slid|higher|lower|in focus|to watch)\b|among (the )?(day'?s|today'?s|top|biggest)? ?movers|premarket movers|stocks moving/i;

const EVENT_KEYWORD_PATTERN =
  /\b(earnings|reports|beats|misses|EPS|revenue|guidance|outlook|raises|cuts|acqui|merger|takeover|FDA|FTC|DOJ|approval|approves|rejects|launch|contract|award|CEO|CFO|resigns|appoints|upgraded|downgraded|price target|offering|convertible|dividend|buyback|repurchase)\b/i;

export function extractCandidateEvidence(input: {
  ticker: string;
  companyName: string;
  headline: string;
  summary: string;
  symbols: string[];
}): CandidateRelevantEvidence {
  const { ticker, companyName, headline, summary, symbols } = input;
  const fullText = [headline, summary].filter(Boolean).join(". ");
  const sentences = splitSentences(fullText);

  const relevantSentences = sentences.filter((sentence) => hasMention(sentence, ticker, companyName));
  const pieces: string[] = [];
  let attachedCausal = false;
  for (const sentence of relevantSentences) {
    const segments = splitSegments(sentence);
    const mentionIndex = segments.findIndex((segment) => hasMention(segment.text, ticker, companyName));
    let linked = false;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const mention = hasMention(segment.text, ticker, companyName);
      const otherTicker = mentionsOtherTicker(segment.text, symbols, ticker);
      if (mention) {
        pieces.push(segment.text);
        linked = true;
      } else if (linked && segment.causal && !otherTicker) {
        // Syntactically linked causal complement for THIS candidate.
        pieces.push(segment.text);
        attachedCausal = true;
        linked = true;
      } else if (segment.causal && !otherTicker && mentionIndex >= 0 && i < mentionIndex) {
        // Leading causal complement that directly precedes the candidate clause.
        pieces.push(segment.text);
        attachedCausal = true;
        linked = true;
      } else {
        linked = false;
      }
    }
  }
  const uniqueClauses = [...new Set(pieces.map((piece) => piece.trim()))].filter((piece) => piece.length > 0);
  const text = uniqueClauses.join(". ");
  const singleSymbol =
    Array.isArray(symbols) && symbols.length > 0 && symbols.every((symbol) => symbol.toUpperCase() === ticker.toUpperCase());

  const hasMentionClauses = uniqueClauses.length > 0;
  if (!hasMentionClauses && singleSymbol) {
    // Single-symbol article: full text is attributable to the candidate.
    return {
      text: fullText,
      specific: true,
      contextOnly: false,
      sentences: sentences.slice(0, 3),
    };
  }

  if (!hasMentionClauses) {
    return { text: "", specific: false, contextOnly: true, sentences: [] };
  }

  // Bare ticker/name token or short truncation inside a movers roundup.
  const truncated = uniqueClauses.some(
    (clause) => clause.split(/\s+/).filter(Boolean).length <= 3 && !EVENT_KEYWORD_PATTERN.test(clause),
  );
  const contextOnly = !attachedCausal && !EVENT_KEYWORD_PATTERN.test(text) && (CONTEXT_PATTERN.test(text) || truncated);
  return {
    text,
    specific: true,
    contextOnly,
    sentences: contextOnly ? [] : uniqueClauses.slice(0, 3),
  };
}
