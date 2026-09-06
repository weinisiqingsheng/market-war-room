#!/usr/bin/env node
/**
 * Layout / visual audit probe for Market War Room (Phase 0B).
 * Extracts real geometry + computed styles from the running page so the
 * fidelity pass is data-driven even without a human eye on the pixels.
 *
 * Usage:
 *   npm run audit [-- --url=http://localhost:3103] [-- --viewport=1440x900]
 */
import puppeteer from "puppeteer-core";

const arg = (flag, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const URL = arg("url", "http://localhost:3103");
const [VIEW_W, VIEW_H] = arg("viewport", "1440x900").split("x").map(Number);
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});

const page = await browser.newPage();
await page.setViewport({ width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "networkidle0", timeout: 30_000 });
await page.evaluate(() => document.fonts?.ready);
await new Promise((r) => setTimeout(r, 600));

const report = await page.evaluate(() => {
  const style = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").trim().slice(0, 40),
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      font: s.font,
      size: s.fontSize,
      weight: s.fontWeight,
      color: s.color,
      bg: s.backgroundColor,
      radius: s.borderRadius,
      border: s.borderTopColor,
      shadow: s.boxShadow,
      display: s.display,
      wrap: s.overflowWrap + " / " + s.whiteSpace,
    };
  };

  const main = document.querySelector("main");
  const header = document.querySelector("header");
  const body = document.body;

  const overflowEls = [];
  const docW = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > docW + 1 || r.left < -1)) {
      overflowEls.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 70)) || "",
        text: (el.textContent ?? "").trim().slice(0, 30),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  }

  return {
    viewport: [document.documentElement.clientWidth, window.innerHeight],
    body: {
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      bg: getComputedStyle(body).backgroundColor,
      bgImage: getComputedStyle(body).backgroundImage.slice(0, 80),
    },
    header: style(header),
    main: style(main),
    h1: style(document.querySelector("h1")),
    nav: style(document.querySelector("nav")),
    sections: [...document.querySelectorAll("main section")].map((s) => {
      const firstCard = s.querySelector(".rounded-2xl,.rounded-3xl") ?? s.firstElementChild;
      return {
        id: s.id,
        cardW: firstCard ? Math.round(firstCard.getBoundingClientRect().width) : 0,
        top: Math.round(s.getBoundingClientRect().top),
        h2: s.querySelector("h2")?.textContent,
      };
    }),
    regime: (() => {
      const card = document.querySelector("#market-regime .rounded-3xl");
      const score = [...document.querySelectorAll("#market-regime *")].find(
        (el) => el.textContent?.trim() === "42" && el.className?.includes?.("text-6xl"),
      );
      const spectrum = document.querySelector("#market-regime [role=meter]");
      const drivers = document.querySelectorAll("#market-regime .rounded-xl");
      const explanation = [...document.querySelectorAll("#market-regime p")].find((p) =>
        p.textContent?.includes("Rising yields"),
      );
      return {
        card: style(card),
        score: style(score),
        spectrum: style(spectrum),
        driverWidths: [...drivers].map((d) => Math.round(d.getBoundingClientRect().width)),
        explanation: style(explanation),
      };
    })(),
    pulse: (() => {
      const cards = document.querySelectorAll("#market-pulse article");
      return [...cards].map((c) => {
        const p = c.getBoundingClientRect();
        const h3 = c.querySelector("h3");
        return {
          ticker: h3?.textContent,
          w: Math.round(p.width),
          h: Math.round(p.height),
          bg: getComputedStyle(c).backgroundColor,
          radius: getComputedStyle(c).borderRadius,
        };
      });
    })(),
    macro: (() => {
      const cells = document.querySelectorAll("#macro-pulse li > div");
      return [...cells].map((c) => {
        const p = c.getBoundingClientRect();
        return {
          w: Math.round(p.width),
          h: Math.round(p.height),
          bg: getComputedStyle(c).backgroundColor,
        };
      });
    })(),
    pairs: (() => {
      const grids = document.querySelectorAll("main > div.space-y-10 > div.grid");
      return [...grids].map((g) => {
        const children = [...g.children].map((c) => {
          const r = c.getBoundingClientRect();
          return {
            id: c.querySelector("section")?.id,
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        });
        return children;
      });
    })(),
    overflowEls: overflowEls.slice(0, 25),
    truncated: [...document.querySelectorAll(".truncate")]
      .filter((el) => {
        return el.scrollWidth > el.clientWidth + 1;
      })
      .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
