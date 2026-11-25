import { beforeEach, describe, expect, it, vi } from "vitest";

// localStorage does not exist in the node test env; this fake also lets a test
// make writes fail, which is the case that decides whether a sale is lost.
class FakeStorage {
  private map = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.map.set(k, v);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new FakeStorage();
vi.stubGlobal("window", { localStorage: storage });
vi.stubGlobal("localStorage", storage);

const {
  dropSale,
  newUid,
  nextLocalNo,
  noteFailure,
  pendingCount,
  pendingSales,
  queueSale,
} = await import("./offline-queue");

const sale = (uid: string, localNo = 1) => ({
  uid,
  localNo,
  at: 1_700_000_000_000,
  lines: [{ itemId: "i1", variantId: null, flavor: null, qty: 2 }],
  discount: 0,
  extra: 0,
  extraNote: null,
  table: null,
  note: null,
  total: 5000,
  tries: 0,
  lastError: null,
});

describe("offline queue", () => {
  beforeEach(() => {
    storage.clear();
    storage.failWrites = false;
  });

  it("holds a sale and reports it", () => {
    expect(queueSale(sale("a"))).toBe(true);
    expect(pendingCount()).toBe(1);
    expect(pendingSales()[0].total).toBe(5000);
  });

  it("is idempotent on the same uid — a retry must not duplicate the sale", () => {
    queueSale(sale("a"));
    queueSale(sale("a"));
    expect(pendingCount()).toBe(1);
  });

  it("drops a sale only when asked, and only that one", () => {
    queueSale(sale("a"));
    queueSale(sale("b", 2));
    dropSale("a");
    expect(pendingSales().map((s) => s.uid)).toEqual(["b"]);
  });

  it("keeps a failed sale and counts the attempt", () => {
    queueSale(sale("a"));
    noteFailure("a", "network");
    noteFailure("a", "network");
    const s = pendingSales()[0];
    expect(s.tries).toBe(2);
    expect(s.lastError).toBe("network");
    expect(pendingCount()).toBe(1); // never dropped on failure
  });

  it("reports failure to store rather than pretending the sale is safe", () => {
    storage.failWrites = true;
    expect(queueSale(sale("a"))).toBe(false);
  });

  it("survives corrupt storage instead of throwing", () => {
    storage.setItem("pz-offline-sales", "{not json");
    expect(pendingSales()).toEqual([]);
    expect(() => queueSale(sale("a"))).not.toThrow();
  });

  it("never reuses a local receipt number", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 25; i++) seen.add(nextLocalNo());
    expect(seen.size).toBe(25);
  });

  it("keeps counting local numbers up even after sales are sent", () => {
    const first = nextLocalNo();
    queueSale(sale("a", first));
    dropSale("a"); // sent and confirmed
    expect(nextLocalNo()).toBe(first + 1);
  });

  it("makes a distinct uid every time", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newUid()));
    expect(ids.size).toBe(200);
  });
});
