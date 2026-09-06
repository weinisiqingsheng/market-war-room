# Design — Sakura Finance

Approved visual direction for Market War Room: a professional financial
intelligence dashboard with soft Sakura pink branding, cream/warm-white
backgrounds, pastel pink surfaces, subtle floral elements, rounded-but-not-
childish cards, professional information density, restrained shadows, and a
clear hierarchy. Cute but trustworthy.

## Palette

| Token                         | Value                             | Usage                              |
| ----------------------------- | --------------------------------- | ---------------------------------- |
| `page`                        | `#FFF8FB`                         | page background                    |
| `surface`                     | `#FFFFFF`                         | main surfaces                      |
| `sakura-50 / 100 / 200 / 300` | `#FFF3F7 #FFF5F8 #FFF7FA #FBE8F0` | soft Sakura surfaces               |
| `lavender`                    | `#F9F4FF`                         | light purple secondary surface     |
| `cream`                       | `#FFF9F0`                         | warm cream                         |
| `mint`                        | `#F3FAF7`                         | soft green                         |
| `ink`                         | `#4A3A4C`                         | primary dark text                  |
| `ink-secondary`               | `#7C6874`                         | secondary text                     |
| `ink-muted`                   | `#A88E9B`                         | muted text — captions/labels only  |
| `brand`                       | `#C15C82`                         | brand pink                         |
| `brand-deep`                  | `#A84E73`                         | text-on-pink contrast variant      |
| `accent`                      | `#D86E95`                         | pink accent                        |
| `softpink`                    | `#F3A9C1`                         | soft pink (decoration, highlights) |
| `pos / pos-bg`                | `#2F7D5C / #E9F5EE`               | positive signals                   |
| `neg / neg-bg`                | `#B04E62 / #FBEFF0`               | negative / risk-off                |
| `warn / warn-bg`              | `#A86A1B / #FBF2E2`               | warning                            |
| `line / line-strong`          | `#F2E4EB / #E9D6E0`               | very light pink-gray borders       |

## Typography

- **Inter** (self-hosted via `next/font`) everywhere.
- Financial numbers use **tabular numerals** (`font-variant-numeric: tabular-nums`).
- Clean, modern, intelligence-product scale — no oversized marketing type.

## Components language

- Cards: `rounded-2xl` (hero `rounded-3xl`), hairline `border-line`,
  restrained `shadow-card` / `shadow-soft` drop shadows. No heavy black borders.
- Flowers belong around the **brand**, **Market Regime**, **AI Market Brief**,
  **Ask War Room**, and occasional section-corner accents — at low opacity,
  `aria-hidden`, `pointer-events-none`. Data readability always wins.
- Positive/negative are never communicated by color alone: arrows, glyphs and
  text labels accompany every tone.

## Demo-data labeling

Phase 0A renders fixtures only. A subtle global **DESIGN PREVIEW** banner plus
per-module **Demo** tags make provenance explicit without dominating the UI.

## Tokens in code

Theme tokens live in `apps/web/app/globals.css` (`@theme`), Tailwind CSS v4.
Breakpoint `xl` is overridden to `75rem` (1200px) to match the approved desktop
target of 1440px viewport / ~1360px content.
