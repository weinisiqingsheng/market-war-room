import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Header } from "@/components/Header";
import { demoHeaderNav, demoSession } from "@/data/demo-market";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: (props: {
      href: string;
      children: React.ReactNode;
      className?: string;
      "aria-current"?: string;
    }) =>
      React.createElement(
        "a",
        { href: props.href, className: props.className, "aria-current": props["aria-current"] },
        props.children,
      ),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderHeaderAt(pathname: string) {
  pathnameMock.mockReturnValue(pathname);
  return render(<Header nav={demoHeaderNav} session={demoSession} mode="demo" meta={null} />);
}

function linksByName(name: string): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a")].filter((a) =>
    a.textContent?.trim().includes(name),
  );
}

describe("primary navigation", () => {
  it("defines Overview → / and Markets → /markets with no future-phase flag", () => {
    const overview = demoHeaderNav.find((item) => item.id === "overview");
    const markets = demoHeaderNav.find((item) => item.id === "markets");
    expect(overview).toMatchObject({ href: "/" });
    expect(overview?.disabled).toBeFalsy();
    expect(markets).toMatchObject({ href: "/markets" });
    expect(markets?.disabled).toBeFalsy();
  });

  it("keeps Intelligence disabled", () => {
    const intelligence = demoHeaderNav.find((item) => item.id === "intelligence");
    expect(intelligence?.disabled).toBe(true);
  });

  it("renders Overview and Markets links on both desktop and mobile navs", () => {
    renderHeaderAt("/markets");
    expect(linksByName("Overview")).toHaveLength(2);
    expect(linksByName("Markets")).toHaveLength(2);
    for (const link of linksByName("Overview")) expect(link.getAttribute("href")).toBe("/");
    for (const link of linksByName("Markets")) expect(link.getAttribute("href")).toBe("/markets");
  });

  it("shows the future-phase tooltip only for Intelligence", () => {
    renderHeaderAt("/markets");
    const disabledPills = [...document.querySelectorAll('[aria-disabled="true"]')];
    expect(disabledPills).toHaveLength(2); // desktop + mobile duplicate of the same item
    expect(document.querySelectorAll('[title="Available in a future phase"]')).toHaveLength(2);
    expect(
      [...document.querySelectorAll("a")].some((a) => a.textContent?.trim() === "Intelligence"),
    ).toBe(false);
  });

  it("marks Overview active on / and Markets inactive", () => {
    renderHeaderAt("/");
    for (const link of linksByName("Overview")) expect(link.className).toContain("bg-brand-deep");
    for (const link of linksByName("Markets")) {
      expect(link.className).not.toContain("bg-brand-deep");
      expect(link.className).toContain("text-ink-secondary");
    }
    for (const link of linksByName("Overview"))
      expect(link.getAttribute("aria-current")).toBe("page");
    for (const link of linksByName("Markets")) expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("marks Markets active on /markets and Overview inactive", () => {
    renderHeaderAt("/markets");
    for (const link of linksByName("Markets")) expect(link.className).toContain("bg-brand-deep");
    for (const link of linksByName("Overview")) {
      expect(link.className).not.toContain("bg-brand-deep");
      expect(link.className).toContain("text-ink-secondary");
    }
    for (const link of linksByName("Markets"))
      expect(link.getAttribute("aria-current")).toBe("page");
    for (const link of linksByName("Overview"))
      expect(link.getAttribute("aria-current")).toBeNull();
  });
});
