import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:3103";
const W = 1440;
const H = 900;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts?.ready);
await new Promise((r) => setTimeout(r, 700));

const probes = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  };
  const list = (sel) =>
    [...document.querySelectorAll(sel)].map((el) => {
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x + b.width / 2),
        y: Math.round(b.y + b.height / 2),
        label: el.querySelector("h3")?.textContent,
      };
    });
  return {
    bodyBg: r("body"),
    header: r("header"),
    regimeCard: r("#market-regime .rounded-3xl"),
    regimeScore: r("#market-regime .text-6xl"),
    spectrum: r("#market-regime [role=meter]"),
    spectrumLeft: (() => {
      const el = document.querySelector("#market-regime [role=meter]");
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x + b.width * 0.08), y: Math.round(b.y + b.height * 0.1) };
    })(),
    spectrumRight: (() => {
      const el = document.querySelector("#market-regime [role=meter]");
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x + b.width * 0.92), y: Math.round(b.y + b.height * 0.1) };
    })(),
    pulse: list("#market-pulse article"),
    macroFirst: r("#macro-pulse li > div"),
    sectorRow: r("#sector-rotation ul li"),
    breadthCard: r("#market-breadth .rounded-2xl"),
    anomaliesTable: r("#market-anomalies table"),
    askButton: r("#ask-war-room button[type=submit]"),
  };
});

const buf = Buffer.from(await page.screenshot({ type: "png", fullPage: true }));
await browser.close();

const png = PNG.sync.read(buf);
const sample = (x, y) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return null;
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};
const hex = (c) => (c ? `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}` : "OOB");

for (const [name, p] of Object.entries(probes)) {
  if (!p) {
    console.log(name.padEnd(16), "not found");
    continue;
  }
  if (Array.isArray(p)) {
    for (const q of p)
      console.log(name.padEnd(16), (q.label ?? "").padEnd(6), hex(sample(q.x, q.y)));
  } else {
    console.log(name.padEnd(16), `(${p.x},${p.y})`, hex(sample(p.x, p.y)));
  }
}
