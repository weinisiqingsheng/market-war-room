import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP = "http://localhost:3104";

const api = await fetch(`${APP}/api/macro/overview`);
const overview = await api.json();

console.log("=== GET /api/macro/overview ===");
console.log("meta:", JSON.stringify(overview.meta));
for (const s of overview.signals) {
  console.log(
    `${s.id.padEnd(7)} value=${String(s.value).padStart(8)} chgPct=${String(s.changePct).padStart(7)} ` +
      `interp=${s.interpretation} tone=${s.tone} src=${s.source} freq=${s.frequency} avail=${s.available}`,
  );
}
const text = JSON.stringify(overview);
console.log(
  "creds leaked:",
  ["fred-key", "twelve-key", "test-key", "test-secret", "APCA-API"].some((k) => text.includes(k)),
);
console.log(
  "raw shapes leaked:",
  ["observations", "previous_close", "latestTrade"].some((k) => text.includes(k)),
);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(APP, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts?.ready);
await new Promise((r) => setTimeout(r, 1800));

const dom = await page.evaluate(() => {
  const body = document.body.innerText;
  const macro = document.querySelector("#macro-pulse");
  const cells = macro ? [...macro.querySelectorAll("li > div")] : [];
  return {
    macroTag: (
      macro?.querySelector(".uppercase")?.parentElement?.parentElement?.textContent ?? ""
    ).trim(),
    provenanceLines: cells.map((c) => c.querySelector("p:last-child")?.textContent?.trim()),
    values: cells.map((c) => c.querySelector("p.tabular-nums")?.textContent?.trim()),
    header: (document.querySelector("header")?.innerText ?? "").replace(/\s+/g, " ").trim(),
    banner: (document.querySelector('[role="note"]')?.innerText ?? "").replace(/\s+/g, " ").trim(),
    demoLeaked: body.includes("563.24") || body.includes("15.42"),
  };
});

console.log("=== DOM probe (live macro) ===");
console.log(JSON.stringify(dom, null, 2));
await page.screenshot({
  path: "docs/screenshots/market-war-room-desktop-live-macro.png",
  fullPage: true,
});
await browser.close();
