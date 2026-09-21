import "server-only";
import type {
  JevProviderAnswer,
  JevProviderRequest,
  JevProviderResponse,
  JevTransport,
  JevTransportEnvelope,
} from "./types";

function equalDistribution(keys: string[]): Record<string, number> {
  const value = keys.length === 0 ? 0 : 1 / keys.length;
  return Object.fromEntries(keys.map((key) => [key, value]));
}

function fixtureAnswer(question: JevProviderRequest["questions"][string]): JevProviderAnswer {
  if (question.type === "noul") return { type: "noul", noul: 0.5 };
  if (question.type === "choice") {
    const options = Object.keys(question.criteria);
    const probabilities = equalDistribution(options);
    return {
      type: "choice",
      choice: options[0] ?? "",
      probabilities,
      confidence: options.length > 0 ? 1 / options.length : 0,
    };
  }
  const levels = question.criteria.map((_, index) => String(index));
  const probabilities = equalDistribution(levels);
  const legend = Object.fromEntries(
    question.criteria.map((level, index) => [
      String(index),
      typeof level === "string" ? level : JSON.stringify(level),
    ]),
  );
  return {
    type: "score",
    score: levels.length === 0 ? 0 : (levels.length - 1) / 2,
    legend,
    probabilities,
    confidence: levels.length > 0 ? 1 / levels.length : 0,
  };
}

export function createFixtureTransport(): JevTransport {
  return {
    async evaluate(request, requestFingerprint): Promise<JevTransportEnvelope> {
      const response: JevProviderResponse = {
        model: "jev-1.13.0",
        answers: Object.fromEntries(
          Object.entries(request.questions).map(([id, question]) => [id, fixtureAnswer(question)]),
        ),
        usage: {
          input_tokens: Math.max(1, Math.ceil(JSON.stringify(request).length / 4)),
          output_tokens: Math.max(1, Object.keys(request.questions).length * 8),
        },
      };
      return { transport: "fixture", response, requestFingerprint, latencyMs: 0 };
    },
  };
}
