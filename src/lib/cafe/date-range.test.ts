import { describe, expect, it } from "vitest";
import { assertDayRange, isValidRange, MAX_RANGE_DAYS, presets, rangeDays } from "./date-range";

describe("rangeDays", () => {
  it("counts a single day as one", () => {
    expect(rangeDays("2026-09-01", "2026-09-01")).toBe(1);
  });

  it("counts inclusively across a month", () => {
    expect(rangeDays("2026-09-01", "2026-09-30")).toBe(30);
  });

  it("counts across a month boundary", () => {
    expect(rangeDays("2026-08-28", "2026-09-02")).toBe(6);
  });

  it("is NaN for a malformed date", () => {
    expect(rangeDays("2026-9-1", "2026-09-30")).toBeNaN();
    expect(rangeDays("garbage", "2026-09-30")).toBeNaN();
  });

  it("is NaN for a well-formed but impossible date", () => {
    expect(rangeDays("2026-02-30", "2026-03-01")).toBeNaN();
    expect(rangeDays("2026-13-01", "2026-13-05")).toBeNaN();
  });
});

describe("assertDayRange", () => {
  it("accepts a normal range", () => {
    expect(() => assertDayRange("2026-09-01", "2026-09-15")).not.toThrow();
  });

  it("rejects a malformed date", () => {
    expect(() => assertDayRange("2026-9-1", "2026-09-15")).toThrow("تاريخ غير صالح");
  });

  it("rejects an impossible date", () => {
    expect(() => assertDayRange("2026-02-30", "2026-03-05")).toThrow("تاريخ غير صالح");
  });

  it("rejects a reversed range", () => {
    expect(() => assertDayRange("2026-09-15", "2026-09-01")).toThrow("تاريخ البداية بعد تاريخ النهاية");
  });

  it("accepts exactly the maximum span and rejects one day more", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    const atLimit = new Date(start + (MAX_RANGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    const overLimit = new Date(start + MAX_RANGE_DAYS * 86_400_000).toISOString().slice(0, 10);
    expect(rangeDays("2026-01-01", atLimit)).toBe(MAX_RANGE_DAYS);
    expect(() => assertDayRange("2026-01-01", atLimit)).not.toThrow();
    expect(() => assertDayRange("2026-01-01", overLimit)).toThrow(String(MAX_RANGE_DAYS));
  });
});

describe("isValidRange", () => {
  it("mirrors assertDayRange without throwing", () => {
    expect(isValidRange("2026-09-01", "2026-09-15")).toBe(true);
    expect(isValidRange("2026-09-15", "2026-09-01")).toBe(false);
    expect(isValidRange("junk", "2026-09-01")).toBe(false);
    expect(isValidRange("2026-01-01", "2026-12-31")).toBe(false);
  });
});

describe("presets", () => {
  const p = presets("2026-09-14");
  const by = (k: string) => p.find((x) => x.key === k)!;

  it("covers today and yesterday as single days", () => {
    expect(by("today")).toMatchObject({ from: "2026-09-14", to: "2026-09-14" });
    expect(by("yesterday")).toMatchObject({ from: "2026-09-13", to: "2026-09-13" });
  });

  it("makes «آخر ٧ أيام» seven days including today", () => {
    const d7 = by("d7");
    expect(d7.from).toBe("2026-09-08");
    expect(rangeDays(d7.from, d7.to)).toBe(7);
  });

  it("makes «آخر ٣٠ يوماً» thirty days including today", () => {
    const d30 = by("d30");
    expect(rangeDays(d30.from, d30.to)).toBe(30);
  });

  it("starts «هذا الشهر» on the first", () => {
    expect(by("month")).toMatchObject({ from: "2026-09-01", to: "2026-09-14" });
  });

  it("spans the whole previous month", () => {
    expect(by("prevMonth")).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles a previous month shorter than 31 days", () => {
    const march = presets("2026-03-10").find((x) => x.key === "prevMonth")!;
    expect(march).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("handles January, where the previous month is last year", () => {
    const jan = presets("2026-01-05").find((x) => x.key === "prevMonth")!;
    expect(jan).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("keeps every preset inside the allowed span", () => {
    for (const x of p) expect(isValidRange(x.from, x.to)).toBe(true);
  });
});
