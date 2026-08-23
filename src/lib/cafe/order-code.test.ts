import { describe, expect, it } from "vitest";
import { orderCode } from "./order-code";

describe("orderCode", () => {
  it("always returns a 3-digit code in 100..999", () => {
    for (const day of ["2026-08-22", "2026-01-01", "2027-12-31"]) {
      for (let seq = 1; seq <= 900; seq++) {
        const code = orderCode(seq, day);
        expect(code).toMatch(/^\d{3}$/);
        expect(Number(code)).toBeGreaterThanOrEqual(100);
        expect(Number(code)).toBeLessThanOrEqual(999);
      }
    }
  });

  it("never collides within a day (bijective over 900 orders)", () => {
    for (const day of ["2026-08-22", "2026-02-14", "2026-11-03"]) {
      const seen = new Set<string>();
      for (let seq = 1; seq <= 900; seq++) seen.add(orderCode(seq, day));
      expect(seen.size).toBe(900);
    }
  });

  it("hides the count: the first order of the day is not 001", () => {
    for (const day of ["2026-08-22", "2026-08-23", "2026-08-24"]) {
      expect(orderCode(1, day)).not.toBe("001");
      expect(Number(orderCode(1, day))).toBeGreaterThan(99);
    }
  });

  it("gives the same sequence a different code on a different day", () => {
    const a = orderCode(1, "2026-08-22");
    const b = orderCode(1, "2026-08-23");
    const c = orderCode(1, "2026-08-24");
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it("is deterministic", () => {
    expect(orderCode(14, "2026-08-22")).toBe(orderCode(14, "2026-08-22"));
  });
});
