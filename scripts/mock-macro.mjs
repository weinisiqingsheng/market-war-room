#!/usr/bin/env node
/**
 * Local mock macro providers for Phase 2 live-mode validation.
 *
 * Serves:
 *   GET /series/observations?series_id=...          → FRED-shaped observations
 *                                                    (VIXCLS/DGS10/DTWEXBGS/DCOILWTICO)
 *   GET /price?symbol=XAU/USD&apikey=...            → Twelve Data current price
 *   GET /time_series?symbol=XAU/USD&interval=1day... → Twelve Data daily bars
 *   GET /v1beta3/crypto/us/latest/trades            → Alpaca crypto latest trade
 *   GET /v1beta3/crypto/us/bars                     → Alpaca crypto daily bars
 *
 * Auth: Twelve requires the `apikey` query parameter (server-side only);
 * Alpaca requires the APCA headers; FRED accepts any api_key query value.
 * Missing auth → error payload / 401, proving credentials are attached
 * server-side.
 *
 * Usage: node scripts/mock-macro.mjs [port=9997]
 */
import http from "node:http";

const PORT = Number(process.argv[2] ?? 9997);

const ISO = (offsetMinutes) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

function fredObservations(seriesId) {
  if (seriesId === "VIXCLS") {
    return {
      observations: [
        { date: isoDate(-0), value: "15.21" },
        { date: isoDate(-1), value: "15.85" },
        { date: isoDate(-2), value: "." },
        { date: isoDate(-3), value: "16.10" },
      ],
    };
  }
  if (seriesId === "DTWEXBGS") {
    return {
      observations: [
        { date: isoDate(-0), value: "118.7479" },
        { date: isoDate(-1), value: "118.3583" },
        { date: isoDate(-2), value: "118.4461" },
        { date: isoDate(-3), value: "118.2283" },
      ],
    };
  }
  if (seriesId === "DCOILWTICO") {
    return {
      observations: [
        { date: isoDate(-0), value: "78.54" },
        { date: isoDate(-1), value: "." },
        { date: isoDate(-2), value: "76.62" },
        { date: isoDate(-3), value: "75.94" },
      ],
    };
  }
  return {
    observations: [
      { date: isoDate(-0), value: "4.76" },
      { date: isoDate(-1), value: "4.68" },
      { date: isoDate(-2), value: "4.66" },
      { date: isoDate(-3), value: "4.64" },
    ],
  };
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAgo);
  return d.toISOString().slice(0, 10);
}

/* Twelve Data Gold fixtures — XAU/USD only. No WTI is ever requested. */
const GOLD_PRICE = "2438.10";
const GOLD_BARS = () => ({
  meta: {
    symbol: "XAU/USD",
    interval: "1day",
    currency: "USD",
    exchange_timezone: "America/New_York",
  },
  values: [
    // Today (America/New_York) = still forming — providers must never use it.
    { datetime: isoDate(-0), close: "2438.10" },
    { datetime: isoDate(-1), close: "2416.35" },
    { datetime: isoDate(-2), close: "2401.11" },
  ],
  status: "ok",
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/series/observations" || url.pathname.endsWith("/series/observations")) {
    return send(200, fredObservations(url.searchParams.get("series_id")));
  }

  const twelveAuthorized = (url.searchParams.get("apikey") ?? "").length > 0;
  if (url.pathname === "/price") {
    if (!twelveAuthorized) {
      return send(200, { status: "error", code: 401, message: "Missing api key" });
    }
    if (url.searchParams.get("symbol") !== "XAU/USD") {
      return send(200, { status: "error", code: 404, message: "symbol not found" });
    }
    return send(200, { price: GOLD_PRICE });
  }

  if (url.pathname === "/time_series") {
    if (!twelveAuthorized) {
      return send(200, { status: "error", code: 401, message: "Missing api key" });
    }
    if (url.searchParams.get("symbol") !== "XAU/USD") {
      return send(200, { status: "error", code: 404, message: "symbol not found" });
    }
    return send(200, GOLD_BARS());
  }

  if (url.pathname === "/v1beta3/crypto/us/latest/trades") {
    const keyId = req.headers["apca-api-key-id"];
    const secret = req.headers["apca-api-secret-key"];
    if (!keyId || !secret) return send(401, { code: 40110000, message: "authentication failed" });
    return send(200, { trades: { "BTC/USD": { p: 62150, t: ISO(-1), s: 5 } } });
  }

  if (url.pathname === "/v1beta3/crypto/us/bars") {
    const keyId = req.headers["apca-api-key-id"];
    const secret = req.headers["apca-api-secret-key"];
    if (!keyId || !secret) return send(401, { code: 40110000, message: "authentication failed" });
    return send(200, {
      bars: {
        "BTC/USD": [
          { t: ISO(-24 * 60), c: 61293, o: 61000, h: 61400, l: 60900, v: 12000 },
          { t: ISO(-25 * 60), c: 60500, o: 60000, h: 60800, l: 59800, v: 11000 },
        ],
      },
    });
  }

  return send(404, { status: "error", code: 404, message: "not found" });
});

server.listen(PORT, () => {
  console.log(`mock-macro listening on http://localhost:${PORT}`);
});
