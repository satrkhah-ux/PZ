import { describe, expect, it } from "vitest";
import { isMenuUrl, tableFromUrl } from "./nfc-url";

describe("tableFromUrl", () => {
  it("reads the table a real tag points at", () => {
    expect(tableFromUrl("https://pizzara-modern.netlify.app/menu?t=7")).toBe("7");
    expect(tableFromUrl("https://pizzara-modern.netlify.app/menu?t=4")).toBe("4");
  });

  it("handles named tables written by the qr screen", () => {
    expect(tableFromUrl("https://x.app/menu?t=%D8%AE%D8%A7%D8%B1%D8%AC%D9%8A%201")).toBe("خارجي 1");
  });

  it("returns null for the general menu tag (no table)", () => {
    expect(tableFromUrl("https://x.app/menu")).toBeNull();
    expect(tableFromUrl("https://x.app/menu?t=")).toBeNull();
  });

  it("survives other params and a hash", () => {
    expect(tableFromUrl("https://x.app/menu?src=nfc&t=3#top")).toBe("3");
  });

  it("does not throw on a malformed tag payload", () => {
    expect(tableFromUrl("not a url at all")).toBeNull();
    expect(tableFromUrl("/menu?t=9")).toBe("9");
  });
});

describe("isMenuUrl", () => {
  it("accepts the menu and its variants", () => {
    expect(isMenuUrl("https://x.app/menu?t=1")).toBe(true);
    expect(isMenuUrl("https://x.app/menu/classic?t=1")).toBe(true);
    expect(isMenuUrl("/menu?t=1")).toBe(true);
  });

  it("rejects a tag pointing somewhere else", () => {
    expect(isMenuUrl("https://x.app/dashboard")).toBe(false);
    expect(isMenuUrl("https://example.com/")).toBe(false);
  });
});
