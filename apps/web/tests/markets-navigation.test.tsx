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
  return [...document.querySelectorAll<HTMLAnchorElement>("a")].filter(
    (a) => a.textContent?.trim() === name,
  );
}

describe("primary navigation", () => {
  it("defines Overview, Markets and Intelligence routes with no disabled flags", () => {
    const overview = demoHeaderNav.find((item) => item.id === "overview");
    const markets = demoHeaderNav.find((item) => item.id === "markets");
    const intelligence = demoHeaderNav.find((item) => item.id === "intelligence");
    expect(overview).toMatchObject({ href: "/" });
    expect(overview?.disabled).toBeFalsy();
    expect(markets).toMatchObject({ href: "/markets" });
    expect(markets?.disabled).toBeFalsy();
    expect(intelligence).toMatchObject({ href: "/intelligence" });
    expect(intelligence?.disabled).toBeFalsy();
  });

  it("renders all three links on both desktop and mobile navs", () => {
    renderHeaderAt("/intelligence");
    expect(linksByName("Overview")).toHaveLength(2);
    expect(linksByName("Markets")).toHaveLength(2);
    expect(linksByName("Intelligence")).toHaveLength(2);
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('[title="Available in a future phase"]')).toHaveLength(0);
  });

  it("marks Overview active on / with Markets and Intelligence inactive", () => {
    renderHeaderAt("/");
    for (const link of linksByName("Overview")) expect(link.className).toContain("bg-brand-deep");
    for (const link of [...linksByName("Markets"), ...linksByName("Intelligence")]) {
      expect(link.className).not.toContain("bg-brand-deep");
      expect(link.className).toContain("text-ink-secondary");
    }
    for (const link of linksByName("Overview"))
      expect(link.getAttribute("aria-current")).toBe("page");
    for (const link of [...linksByName("Markets"), ...linksByName("Intelligence")])
      expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("marks Markets active on /markets", () => {
    renderHeaderAt("/markets");
    for (const link of linksByName("Markets")) expect(link.className).toContain("bg-brand-deep");
    for (const link of [...linksByName("Overview"), ...linksByName("Intelligence")]) {
      expect(link.className).not.toContain("bg-brand-deep");
      expect(link.className).toContain("text-ink-secondary");
    }
    for (const link of linksByName("Markets"))
      expect(link.getAttribute("aria-current")).toBe("page");
    for (const link of [...linksByName("Overview"), ...linksByName("Intelligence")])
      expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("marks Intelligence active on /intelligence with Overview and Markets inactive", () => {
    renderHeaderAt("/intelligence");
    for (const link of linksByName("Intelligence"))
      expect(link.className).toContain("bg-brand-deep");
    for (const link of [...linksByName("Overview"), ...linksByName("Markets")]) {
      expect(link.className).not.toContain("bg-brand-deep");
      expect(link.className).toContain("text-ink-secondary");
    }
    for (const link of linksByName("Intelligence"))
      expect(link.getAttribute("aria-current")).toBe("page");
    for (const link of [...linksByName("Overview"), ...linksByName("Markets")])
      expect(link.getAttribute("aria-current")).toBeNull();
  });
});
