import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:3104";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts?.ready);
await new Promise((r) => setTimeout(r, 1500)); // allow live fetch to settle

const report = await page.evaluate(() => {
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
  const allText = document.body.innerText;
  return {
    headerText: (document.querySelector("header")?.innerText ?? "").replace(/\s+/g, " ").trim(),
    lastUpdated: (document.querySelector("header")?.innerText ?? "").includes("Last updated"),
    banner: (document.querySelector('[role="note"]')?.innerText ?? "").replace(/\s+/g, " ").trim(),
    liveTags: (allText.match(/LIVE · IEX/gi) ?? []).length,
    demoTags: (allText.match(/\bDEMO\b/g) ?? []).length,
    spyPrice: [...document.querySelectorAll("#market-pulse p")]
      .map((p) => p.textContent?.trim())
      .find((t) => /^500\.12$/.test(t ?? "")),
    demoPriceLeaked: allText.includes("563.24"),
    sparklines: document.querySelectorAll("#market-pulse svg[aria-hidden]").length,
    sectorRows: document.querySelectorAll("#sector-rotation ul li").length,
    sectorLeader:
      document.querySelector("#sector-rotation ul li .font-semibold")?.textContent ?? null,
    macroTag: (document.querySelector("#macro-pulse")?.innerText ?? "").includes("DEMO"),
    staleBadge: allText.includes("Stale"),
  };
});

console.log(JSON.stringify(report, null, 2));
await page.screenshot({
  path: "docs/screenshots/market-war-room-desktop-live.png",
  fullPage: true,
});
await browser.close();
