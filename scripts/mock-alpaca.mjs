#!/usr/bin/env node
/**
 * Local mock Alpaca Market Data API for Phase 1 live-mode validation.
 *
 * Serves:
 *   GET /v2/stocks/snapshots?symbols=...&feed=...  → deterministic snapshot JSON
 *   GET /v2/clock                                  → open market + next open/close
 *
 * Requires the APCA-API-KEY-ID / APCA-API-SECRET-KEY headers (returns 401
 * without them), proving the app attaches credentials server-side.
 *
 * Usage: node scripts/mock-alpaca.mjs [port=9998]
 */
import http from "node:http";

const PORT = Number(process.argv[2] ?? 9998);

const FIXTURES = {
  SPY: { price: 500.12, changePct: -0.24 },
  QQQ: { price: 450.34, changePct: -0.31 },
  IWM: { price: 210.56, changePct: -0.18 },
  DIA: { price: 400.78, changePct: -0.12 },
  XLK: { price: 210.44, changePct: -0.44 },
  XLF: { price: 42.18, changePct: 0.62 },
  XLE: { price: 95.32, changePct: 2.1 },
  XLV: { price: 150.66, changePct: 0.31 },
  XLI: { price: 120.9, changePct: 0.18 },
  XLP: { price: 78.44, changePct: 0.05 },
  XLY: { price: 175.2, changePct: -0.28 },
  XLU: { price: 68.11, changePct: -0.72 },
  XLB: { price: 88.77, changePct: 0.44 },
  XLRE: { price: 36.52, changePct: -0.5 },
  XLC: { price: 82.3, changePct: 0.12 },
};
function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildSnapshot(symbol) {
  const fixture = FIXTURES[symbol];
  if (!fixture) return null;
  const { price, changePct } = fixture;
  const prev = price / (1 + changePct / 100);
  const now = isoMinutesAgo(1);
  const today = isoMinutesAgo(5 * 60);
  const yesterday = isoMinutesAgo(24 * 60 + 5 * 60);
  return {
    latestTrade: { t: now, x: "V", p: price, s: Math.round(price * 1000), z: "C" },
    minuteBar: { t: now, o: prev, h: price * 1.002, l: price * 0.995, c: price, v: 1200, n: 40 },
    dailyBar: {
      t: today,
      o: prev,
      h: price * 1.003,
      l: price * 0.994,
      c: price,
      v: 850000,
      n: 9000,
    },
    prevDailyBar: {
      t: yesterday,
      o: prev * 0.999,
      h: prev * 1.005,
      l: prev * 0.993,
      c: prev,
      v: 820000,
      n: 8800,
    },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const keyId = req.headers["apca-api-key-id"];
  const secret = req.headers["apca-api-secret-key"];

  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (!keyId || !secret) {
    return send(401, { code: 40110000, message: "authentication failed" });
  }

  if (url.pathname === "/v2/clock") {
    return send(200, {
      timestamp: new Date().toISOString(),
      is_open: true,
      next_open: isoMinutesAgo(-15 * 60),
      next_close: isoMinutesAgo(-6 * 60),
    });
  }

  if (url.pathname === "/v2/stocks/snapshots") {
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const snapshots = {};
    for (const symbol of symbols) {
      const built = buildSnapshot(symbol);
      if (built) snapshots[symbol] = built;
    }
    return send(200, snapshots);
  }

  // Alpaca crypto (Phase 2 macro — BTC/USD)
  if (url.pathname === "/v1beta3/crypto/us/latest/trades") {
    return send(200, {
      trades: { "BTC/USD": { p: 62150, t: isoMinutesAgo(-1), s: 5 } },
    });
  }
  if (url.pathname === "/v1beta3/crypto/us/bars") {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    const startOfYesterdayUtc = new Date(startOfTodayUtc.getTime() - 24 * 60 * 60_000);
    const withNanos = (iso) => iso.replace(/\.(\d{3})Z$/, ".$1000000Z");
    return send(200, {
      bars: {
        "BTC/USD": [
          {
            t: withNanos(startOfYesterdayUtc.toISOString()),
            c: 78000,
            o: 77000,
            h: 78500,
            l: 76900,
            v: 9000,
            n: 100,
          },
          {
            t: withNanos(startOfTodayUtc.toISOString()),
            c: 79000,
            o: 78000,
            h: 79200,
            l: 77900,
            v: 500,
            n: 20,
          },
        ],
      },
    });
  }

  return send(404, { code: 40400000, message: "not found" });
});

server.listen(PORT, () => {
  console.log(`mock-alpaca listening on http://localhost:${PORT}`);
});
