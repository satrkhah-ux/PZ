import { describe, expect, it } from "vitest";
import { TIERS, fitColumn, justWentReady, pageNow, pageSlice, slideNow, splitColumns, type QueueRow } from "./queue-display";

const row = (id: string, prep: "preparing" | "ready"): QueueRow => ({ id, code: id, prep_status: prep, table_no: null });

describe("fitColumn", () => {
  it("uses the LARGEST tier when everything fits", () => {
    const { tier, pages } = fitColumn(1, 800);
    expect(tier.font).toBe(TIERS[0].font);
    expect(pages).toBe(1);
  });

  it("shrinks as the count grows", () => {
    const few = fitColumn(2, 400).tier.font;
    const many = fitColumn(20, 400).tier.font;
    expect(many).toBeLessThanOrEqual(few);
  });

  it("never goes below the readable floor, it paginates instead", () => {
    const { tier, pages } = fitColumn(400, 400);
    expect(tier.font).toBe(44);
    expect(pages).toBeGreaterThan(1);
  });

  it("survives a tiny measured height (real TVs report less than paper says)", () => {
    const { tier, perPage, pages } = fitColumn(6, 90);
    expect(tier.font).toBe(44);
    expect(perPage).toBeGreaterThanOrEqual(1);
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  it("extra column lets the ready side hold more before paging", () => {
    const plain = fitColumn(12, 500, 0);
    const wide = fitColumn(12, 500, 1);
    expect(wide.perPage).toBeGreaterThan(plain.perPage);
  });

  it("always reports at least one page", () => {
    expect(fitColumn(0, 500).pages).toBe(1);
  });
});

describe("pageNow", () => {
  it("stays on page 0 when everything fits", () => {
    expect(pageNow(3, 10, 8, 1_000_000)).toBe(0);
  });

  it("advances with the clock and wraps", () => {
    const at = (s: number) => pageNow(10, 4, 8, s * 1000); // 3 pages
    expect(at(0)).toBe(0);
    expect(at(8)).toBe(1);
    expect(at(16)).toBe(2);
    expect(at(24)).toBe(0);
  });

  it("gives the SAME answer for the same instant (server and client agree)", () => {
    const t = 1_724_600_000_000;
    expect(pageNow(10, 4, 8, t)).toBe(pageNow(10, 4, 8, t));
  });

  it("is immune to a page rebuild — it never counts, it reads the clock", () => {
    const t = 1_724_600_000_000 + 8_000 * 5;
    expect(pageNow(10, 4, 8, t)).toBe(pageNow(10, 4, 8, t));
  });
});

describe("pageSlice", () => {
  it("returns the rows of the requested page", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(pageSlice(rows, 2, 0)).toEqual([1, 2]);
    expect(pageSlice(rows, 2, 2)).toEqual([5]);
  });
});

describe("justWentReady (edge, not level)", () => {
  it("rings when a new id becomes ready", () => {
    expect(justWentReady(["a"], ["a", "b"])).toBe(true);
  });

  it("does NOT ring while the same order stays ready", () => {
    expect(justWentReady(["a"], ["a"])).toBe(false);
  });

  it("does not ring on an empty board", () => {
    expect(justWentReady([], [])).toBe(false);
    expect(justWentReady(["a"], [])).toBe(false);
  });

  it("rings on the very first ready order", () => {
    expect(justWentReady([], ["a"])).toBe(true);
  });
});

describe("slideNow", () => {
  it("holds still for a single slide", () => {
    expect(slideNow(1, 10, 999_999)).toBe(0);
  });
  it("rotates with the clock", () => {
    expect(slideNow(3, 10, 0)).toBe(0);
    expect(slideNow(3, 10, 10_000)).toBe(1);
    expect(slideNow(3, 10, 30_000)).toBe(0);
  });
});

describe("splitColumns", () => {
  it("puts every order in exactly one column", () => {
    const rows = [row("a", "preparing"), row("b", "ready"), row("c", "preparing")];
    const { preparing, ready } = splitColumns(rows);
    expect(preparing.map((r) => r.id)).toEqual(["a", "c"]);
    expect(ready.map((r) => r.id)).toEqual(["b"]);
    expect(preparing.length + ready.length).toBe(rows.length);
  });
});
