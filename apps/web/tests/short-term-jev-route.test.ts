import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/short-term/jev/assess/route";

describe("POST /api/short-term/jev/assess", () => {
  it("uses the fixture path and never exposes a live-looking result", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      new Request("http://localhost/api/short-term/jev/assess", {
        method: "POST",
        body: JSON.stringify({
          ticker: "NVDA",
          strategyId: "risk-first",
          horizonHours: 1,
          maxLossPct: 1,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("fixture");
    expect(body.provenance.kind).toBe("fixture");
    expect(body).not.toHaveProperty("rawProviderResponse");
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects malformed requests without invoking a provider", async () => {
    const response = await POST(
      new Request("http://localhost/api/short-term/jev/assess", {
        method: "POST",
        body: JSON.stringify({ ticker: "not valid" }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
});
