#!/usr/bin/env node
/**
 * Visual QA screenshot capture for Market War Room (Phase 0B).
 *
 * Uses puppeteer-core against the system Chrome — no browser download.
 * Usage:
 *   npm run capture  [-- --url=http://localhost:3000] [-- --out=docs/screenshots]
 */
import { mkdir } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const arg = (flag, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const URL = arg("url", "http://localhost:3103");
const OUT = arg("out", "docs/screenshots");
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SHOTS = [
  { name: "market-war-room-desktop", width: 1440, height: 900, label: "Desktop 1440px" },
  { name: "market-war-room-tablet", width: 1024, height: 768, label: "Tablet 1024px" },
  { name: "market-war-room-mobile", width: 390, height: 844, label: "Mobile 390px" },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});

await mkdir(OUT, { recursive: true });

for (const shot of SHOTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30_000 });
  await page.evaluate(() => document.fonts?.ready);
  await new Promise((r) => setTimeout(r, 800)); // settle hover/clock/effects

  const path = `${OUT}/${shot.name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`[${shot.label}] ${fileURLToPath(pathToFileURL(path))}`);

  // Also log a few structural probes for the report.
  const probe = await page.evaluate(() => {
    const body = document.body;
    const main = document.querySelector("main");
    const header = document.querySelector("header");
    return {
      title: document.title,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      h2s: [...document.querySelectorAll("h2")].map((h) => h.textContent),
    };
  });
  console.log(JSON.stringify(probe, null, 2));

  await page.close();
}

await browser.close();
console.log("done");
