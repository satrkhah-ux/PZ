import { describe, expect, it } from "vitest";
import { AFTERNOON_HOUR, dueSlot, slotKey, type Release } from "./whats-new";

const rel: Release = { id: "r1", day: "2026-11-25", title: "t", items: ["a"] };
const nothingSeen = () => false;
/** Baghdad is UTC+3, so this builds a UTC instant for a given Baghdad hour. */
const atBaghdad = (day: string, hour: number) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`.replace("Z", "Z")).getTime() - 3 * 3600_000;
const when = (day: string, hour: number) => new Date(atBaghdad(day, hour));

describe("whats-new slots", () => {
  it("shows the morning notice early on the release day", () => {
    expect(dueSlot(rel, when("2026-11-25", 8), nothingSeen)).toBe("morning");
  });

  it("still calls it morning just before the cutover", () => {
    expect(dueSlot(rel, when("2026-11-25", AFTERNOON_HOUR - 1), nothingSeen)).toBe("morning");
  });

  it("switches to the afternoon notice at 3pm", () => {
    expect(dueSlot(rel, when("2026-11-25", AFTERNOON_HOUR), nothingSeen)).toBe("afternoon");
  });

  it("is still the afternoon notice late at night", () => {
    expect(dueSlot(rel, when("2026-11-25", 23), nothingSeen)).toBe("afternoon");
  });

  it("shows nothing the day before or the day after", () => {
    expect(dueSlot(rel, when("2026-11-24", 10), nothingSeen)).toBeNull();
    expect(dueSlot(rel, when("2026-11-26", 10), nothingSeen)).toBeNull();
  });

  it("does not repeat a slot already shown", () => {
    const seen = (k: string) => k === slotKey(rel, "morning");
    expect(dueSlot(rel, when("2026-11-25", 9), seen)).toBeNull();
    // the afternoon one is a separate slot and still due
    expect(dueSlot(rel, when("2026-11-25", 16), seen)).toBe("afternoon");
  });

  it("shows the afternoon notice even if the morning one was never seen", () => {
    expect(dueSlot(rel, when("2026-11-25", 17), nothingSeen)).toBe("afternoon");
  });

  it("shows nothing once both slots are done", () => {
    const seen = () => true;
    expect(dueSlot(rel, when("2026-11-25", 9), seen)).toBeNull();
    expect(dueSlot(rel, when("2026-11-25", 20), seen)).toBeNull();
  });

  it("uses Baghdad time, not the machine's — 23:30 UTC is already tomorrow there", () => {
    // 2026-11-24T23:30Z is 2026-11-25 02:30 in Baghdad → release day, morning
    expect(dueSlot(rel, new Date("2026-11-24T23:30:00Z"), nothingSeen)).toBe("morning");
    // 2026-11-25T22:00Z is 2026-11-26 01:00 in Baghdad → past the release day
    expect(dueSlot(rel, new Date("2026-11-25T22:00:00Z"), nothingSeen)).toBeNull();
  });

  it("keys the two slots apart", () => {
    expect(slotKey(rel, "morning")).not.toBe(slotKey(rel, "afternoon"));
    expect(slotKey(rel, "morning")).toContain(rel.id);
  });
});
