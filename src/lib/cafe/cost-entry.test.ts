import { describe, expect, it } from "vitest";
import { byKind, costDiff, margin, parseCost } from "./cost-entry";

describe("parseCost", () => {
  it("accepts a plain whole number", () => {
    expect(parseCost("250")).toBe(250);
    expect(parseCost("  1200 ")).toBe(1200);
    expect(parseCost("0")).toBe(0);
  });

  it("treats a blank box as 'unchanged', never as zero", () => {
    // The whole point: 38 items hold 0 already. A cleared box must not be a save.
    expect(parseCost("")).toBeNull();
    expect(parseCost("   ")).toBeNull();
  });

  it("rejects anything that is not western digits", () => {
    expect(parseCost("٢٥٠")).toBeNull(); // Arabic-Indic — project writes 123
    expect(parseCost("1,200")).toBeNull();
    expect(parseCost("12.5")).toBeNull();
    expect(parseCost("-5")).toBeNull();
    expect(parseCost("abc")).toBeNull();
    expect(parseCost("1e3")).toBeNull();
  });
});

describe("costDiff", () => {
  const targets = [
    { id: "water", current: 250, kind: "item" as const },
    { id: "latte", current: 0, kind: "item" as const },
    { id: "size-lg", current: null, kind: "variant" as const }, // no override yet
  ];

  it("sends only rows that actually changed", () => {
    expect(costDiff(targets, { water: "250", latte: "900" })).toEqual([
      { id: "latte", cost: 900, kind: "item" },
    ]);
  });

  it("sends nothing for an untouched screen", () => {
    expect(costDiff(targets, {})).toEqual([]);
  });

  it("never writes 0 over a cost that was already entered", () => {
    // مياه is the one item with a real cost. A blank must leave it at 250.
    expect(costDiff(targets, { water: "" })).toEqual([]);
    expect(costDiff(targets, { water: "٢٥٠" })).toEqual([]);
  });

  it("lets a variant take its first override", () => {
    expect(costDiff(targets, { "size-lg": "1500" })).toEqual([
      { id: "size-lg", cost: 1500, kind: "variant" },
    ]);
  });

  it("accepts a deliberate 0 where the stored value is not already 0", () => {
    expect(costDiff(targets, { water: "0" })).toEqual([{ id: "water", cost: 0, kind: "item" }]);
    expect(costDiff(targets, { latte: "0" })).toEqual([]); // already 0
  });

  it("keeps a size out of menu_items — the silent-no-save case", () => {
    // A variant id sent to menu_items matches no row and PostgREST calls that a
    // success, so misfiling here would look like a save that never happened.
    const { items, variants } = byKind(costDiff(targets, { latte: "900", "size-lg": "1500" }));
    expect(items.map((e) => e.id)).toEqual(["latte"]);
    expect(variants.map((e) => e.id)).toEqual(["size-lg"]);
  });
});

describe("margin", () => {
  it("states the margin when both numbers are real", () => {
    expect(margin(500, 250)).toBe(50);
    expect(margin(3000, 900)).toBe(70);
  });

  it("refuses to call a missing cost a 100% margin", () => {
    expect(margin(3000, 0)).toBeNull();
    expect(margin(3000, null)).toBeNull();
  });

  it("goes negative when the item sells below cost", () => {
    expect(margin(1000, 1500)).toBe(-50);
  });

  it("has nothing to say about a priceless row", () => {
    expect(margin(0, 100)).toBeNull();
  });
});
