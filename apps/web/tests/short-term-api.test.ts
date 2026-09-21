import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/short-term/mock-engine", () => ({
  normalizeShortTermRequest: vi.fn(),
  evaluateShortTermMock: vi.fn(),
}));

import {
  evaluateShortTermMock,
  normalizeShortTermRequest,
} from "@/lib/short-term/mock-engine";
import { POST } from "@/app/api/short-term/analyze/route";

const normalize = vi.mocked(normalizeShortTermRequest);
const evaluate = vi.mocked(evaluateShortTermMock);

beforeEach(() => {
  normalize.mockReset();
  evaluate.mockReset();
});

describe("POST /api/short-term/analyze", () => {
  it("returns an explicitly simulated result without calling an external API", async () => {
    const normalized = {
      ticker: "NVDA",
      strategyId: "momentum-watch" as const,
      horizonHours: 4,
      maxLossPct: 2,
    };
    normalize.mockReturnValue(normalized);
    evaluate.mockReturnValue({ status: "simulated" } as never);

    const response = await POST(
      new Request("http://localhost/api/short-term/analyze", {
        method: "POST",
        body: JSON.stringify(normalized),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "simulated" });
    expect(evaluate).toHaveBeenCalledWith(normalized);
  });

  it("maps validation errors to a safe 400 response", async () => {
    normalize.mockImplementation(() => {
      throw new Error("Ticker is invalid");
    });

    const response = await POST(
      new Request("http://localhost/api/short-term/analyze", {
        method: "POST",
        body: JSON.stringify({ ticker: "bad" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    expect(evaluate).not.toHaveBeenCalled();
  });
});
