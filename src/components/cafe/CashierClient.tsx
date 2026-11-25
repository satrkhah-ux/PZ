"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, Minus, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import type { MenuCategoryView, MenuItemView } from "@/lib/cafe/menu-data";
import { formatIqdLabel } from "@/lib/cafe/money";
import { cashierCheckout, syncOfflineSale } from "@/lib/cafe/cashier-actions";
import {
  dropSale,
  newUid,
  nextLocalNo,
  noteFailure,
  pendingSales,
  queueSale,
  type OfflineSale,
} from "@/lib/cafe/offline-queue";
import { findCard, redeemReward, type Card } from "@/lib/cafe/loyalty-actions";
import { QrScanner } from "./QrScanner";
import { Receipt, type ReceiptData } from "./Receipt";
import { receiptStamp } from "@/lib/cafe/time";
import { ensureFreshSession, isAuthError } from "@/lib/supabase/session";
import { MenuIcon } from "./MenuIcon";
import { PriceInput } from "./PriceInput";
import { FridayPrayerNotice } from "./FridayPrayerNotice";

type Line = {
  key: string;
  itemId: string;
  name: string;
  variantId: string | null;
  flavor: string | null;
  unitPrice: number;
  qty: number;
};
type Cart = Record<string, Line>;
type CartAction = { type: "add"; line: Omit<Line, "qty"> } | { type: "inc"; key: string } | { type: "dec"; key: string } | { type: "clear" };

function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add": {
      const ex = state[action.line.key];
      return { ...state, [action.line.key]: { ...action.line, qty: (ex?.qty ?? 0) + 1 } };
    }
    case "inc": {
      const l = state[action.key];
      return l ? { ...state, [action.key]: { ...l, qty: l.qty + 1 } } : state;
    }
    case "dec": {
      const l = state[action.key];
      if (!l) return state;
      if (l.qty <= 1) {
        const n = { ...state };
        delete n[action.key];
        return n;
      }
      return { ...state, [action.key]: { ...l, qty: l.qty - 1 } };
    }
    case "clear":
      return {};
  }
}

/** How long the till waits for the server before it holds the sale instead.
 *  Long enough for a slow-but-alive link, short enough that a queue of
 *  customers does not watch the screen think. */
const CHECKOUT_TIMEOUT_MS = 7000;

export function CashierClient({ menu, tables }: { menu: MenuCategoryView[]; tables: string[] }) {
  const [activeCat, setActiveCat] = useState(menu[0]?.name_ar ?? "");
  const [cart, dispatch] = useReducer(cartReducer, {});
  const [discount, setDiscount] = useState(0);
  // Percentage mode: null = a manual amount; a number = % of the subtotal, re-derived
  // as items change (derived, not stored, so it can never go stale).
  const [discountPct, setDiscountPct] = useState<number | null>(null);
  // Two buttons above the totals — «إضافة د.ع» / «خصم د.ع» — open ONE fixed panel underneath.
  const [adjust, setAdjust] = useState<"extra" | "discount" | null>(null);
  const [customer, setCustomer] = useState<Card | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessionDead, setSessionDead] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  // sales taken while the line was down, still waiting to be sent
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lostSale, setLostSale] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: string; awarded: number } | null>(null);
  // cash opens the drawer; Qi-card payments happen on the Qi device — no drawer.
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  // dine-in orders carry a table number → they show on the live tables screen
  const [orderType, setOrderType] = useState<"takeaway" | "dinein">("takeaway");
  const [tableNo, setTableNo] = useState("");
  const [orderNote, setOrderNote] = useState("");
  // itemized surcharges for add-ons the customer requests (extra shot, syrup…)
  const [extras, setExtras] = useState<{ name: string; price: number }[]>([]);
  const [extraPrice, setExtraPrice] = useState(0);

  // cash drawer: device setting managed on the /orders screen (same localStorage key).
  const drawerKickRef = useRef(false);
  const kickBusyRef = useRef(false);
  const checkoutBusyRef = useRef(false);
  const flushingRef = useRef(false);
  useEffect(() => {
    drawerKickRef.current = localStorage.getItem("pz-drawer") === "1";
  }, []);
  function kickDrawer() {
    // guard against a double-open if the pay action ever fires twice in quick succession
    if (!drawerKickRef.current || kickBusyRef.current) return;
    kickBusyRef.current = true;
    setTimeout(() => { kickBusyRef.current = false; }, 2500);
    // localhost is exempt from mixed-content blocking; fire-and-forget
    fetch("http://127.0.0.1:9977/kick", { mode: "no-cors" }).catch(() => {});
  }

  // Auto-print the receipt the moment an order completes. Silent one-click under
  // the «كاشير بيزارا» shortcut (--kiosk-printing); the manual طباعة button stays
  // as a reprint. The small delay lets the print-only receipt lay out first.
  useEffect(() => {
    if (!receipt) return;
    const id = setTimeout(() => window.print(), 250);
    return () => clearTimeout(id);
  }, [receipt]);

  const lines = Object.values(cart);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  const extraTotal = useMemo(() => extras.reduce((s, x) => s + x.price, 0), [extras]);
  const appliedDiscount = discountPct != null ? Math.min(subtotal, Math.round((subtotal * discountPct) / 100)) : discount;
  const total = Math.max(0, subtotal - appliedDiscount + extraTotal);

  function addExtra() {
    // description is verbal at the counter — the cashier only enters the amount
    const price = Math.max(0, Math.round(extraPrice || 0));
    if (price <= 0) return;
    setExtras((xs) => [...xs, { name: "إضافة", price }]);
    setExtraPrice(0);
  }
  const cat = menu.find((c) => c.name_ar === activeCat) ?? menu[0];

  async function lookup(serial: string) {
    const s = serial.trim();
    if (!s) return;
    setLoyaltyMsg(null);
    const card = await findCard(s);
    if (!card) {
      setLoyaltyMsg("بطاقة غير موجودة.");
      return;
    }
    setCustomer(card);
  }

  const onScanned = useCallback((text: string) => {
    setScanOpen(false);
    void lookup(text);
  }, []);

  async function redeem() {
    if (!customer) return;
    setLoyaltyMsg(null);
    const res = await redeemReward(customer.id, total);
    if (!res.ok) {
      setLoyaltyMsg(res.error);
      return;
    }
    // ponytail: redeem deducts points immediately, before payment — a cancelled
    // checkout needs a manual adjust-back. Acceptable v1.
    setDiscountPct(null);
    setDiscount((d) => d + res.discount);
    setCustomer({ ...customer, points: res.balance });
    setLoyaltyMsg(`تم استبدال مكافأة — خصم ${formatIqdLabel(res.discount)}`);
  }

  /** Send everything held locally, oldest first, one at a time.
   *
   *  A sale leaves the queue ONLY on a confirmed ok. Anything else — a timeout,
   *  a 500, the line dropping again — leaves it in place to be retried, because
   *  the server refuses a uid it has already recorded, so a resend cannot
   *  double-charge but a premature drop would lose the money for good. */
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    const batch = pendingSales();
    if (!batch.length) {
      setQueued(0);
      return;
    }
    flushingRef.current = true;
    setSyncing(true);
    try {
      for (const sale of batch) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) break;
        try {
          const res = await syncOfflineSale({
            uid: sale.uid,
            lines: sale.lines.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, flavor: l.flavor, qty: l.qty })),
            discount: sale.discount,
            extra: sale.extra,
            extraNote: sale.extraNote,
            table: sale.table,
            note: sale.note,
            printedTotal: sale.total,
          });
          if (res.ok) dropSale(sale.uid);
          else noteFailure(sale.uid, res.error);
        } catch (e) {
          noteFailure(sale.uid, (e as Error).message);
          break; // still offline — stop hammering, the next trigger retries
        }
        setQueued(pendingSales().length);
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      setQueued(pendingSales().length);
    }
  }, []);

  useEffect(() => {
    // Deferred by a tick: flushQueue sets state before its first await, and
    // doing that straight from an effect body cascades renders.
    const kick = () => void flushQueue();
    const first = window.setTimeout(kick, 0);
    window.addEventListener("online", kick);
    const t = window.setInterval(() => {
      if (pendingSales().length) kick();
    }, 60_000);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("online", kick);
      window.clearInterval(t);
    };
  }, [flushQueue]);

  async function checkout() {
    // checkoutBusyRef is synchronous — `busy` state updates a tick later, so a
    // rapid double-tap would otherwise submit twice (double order + double drawer).
    if (!lines.length || checkoutBusyRef.current || busy) return;
    if (orderType === "dinein" && !tableNo) {
      setErr("اختر رقم الطاولة.");
      return;
    }
    checkoutBusyRef.current = true;
    setBusy(true);
    setErr(null);
    // try/finally so the button ALWAYS unsticks — a thrown action (expired
    // session, network drop) must never freeze the cashier on «جار التنفيذ».
    try {
      // Best-effort token renewal — the POS sits open for hours and the machine
      // sleeps, which kills supabase-js's refresh timer. Deliberately NOT a gate:
      // a false negative here must never stop a cashier who is actually signed in;
      // a genuinely dead session is caught below and reported honestly.
      await ensureFreshSession();
      setSessionDead(false);
      const table = orderType === "dinein" ? tableNo : null;
      const extraNote = extras.map((x) => `${x.name} (${formatIqdLabel(x.price)})`).join("، ") || null;
      const payload = lines.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, flavor: l.flavor, qty: l.qty }));
      // The uid is minted HERE, before the first attempt, and the same one is
      // reused if this sale ends up being held and replayed — that is what lets
      // us stop waiting without risking a double sale.
      const uid = newUid();

      // navigator.onLine is only a hint: the usual outage here is the ISP
      // dropping while the router stays up, and the browser cheerfully reports
      // "online" throughout. What decides is whether the request answers.
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      let res: Awaited<ReturnType<typeof cashierCheckout>> | null = null;
      if (!offline) {
        try {
          // A dead line makes a server action hang rather than fail, which froze
          // the till on «جار التنفيذ» until the tab was killed. Stop waiting
          // after CHECKOUT_TIMEOUT_MS and hold the sale instead; if the request
          // lands late, its uid makes the replay a no-op.
          res = await Promise.race([
            cashierCheckout({ lines: payload, discount: appliedDiscount, extra: extraTotal, extraNote, customerId: customer?.id ?? null, table, note: orderNote.trim() || null, clientUid: uid }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), CHECKOUT_TIMEOUT_MS)),
          ]);
        } catch {
          res = null; // the request never completed — fall through and hold it
        }
      }

      if (!res) {
        // Hold the sale, print it, serve the customer. The receipt carries «م-N»
        // so staff can see at a glance which tickets are not yet in the system.
        const localNo = nextLocalNo();
        const stored = queueSale({
          uid,
          localNo,
          at: Date.now(),
          lines: lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, flavor: l.flavor, qty: l.qty })),
          discount: appliedDiscount,
          extra: extraTotal,
          extraNote,
          table,
          note: orderNote.trim() || null,
          total,
          tries: 0,
          lastError: null,
        } satisfies OfflineSale);
        setLostSale(!stored);
        setQueued(pendingSales().length);
        setReceipt({
          orderNumber: `م-${localNo}`,
          table,
          note: orderNote.trim() || null,
          lines: lines.map((l) => ({ name: l.name, flavor: l.flavor, qty: l.qty, unitPrice: l.unitPrice })),
          subtotal,
          discount: appliedDiscount,
          extras,
          total,
          ...receiptStamp(),
        });
        if (payMethod === "cash") kickDrawer();
        setSuccess({ orderNumber: `م-${localNo}`, awarded: 0 });
        dispatch({ type: "clear" });
        setCustomer(null);
        setDiscount(0);
        setDiscountPct(null);
        setAdjust(null);
        setExtras([]);
        setExtraPrice(0);
        setOrderNote("");
        return;
      }

      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setReceipt({
        orderNumber: res.orderNumber,
        table,
        note: orderNote.trim() || null,
        lines: lines.map((l) => ({ name: l.name, flavor: l.flavor, qty: l.qty, unitPrice: l.unitPrice })),
        subtotal,
        discount: appliedDiscount,
        extras,
        total,
        ...receiptStamp(),
      });
      if (payMethod === "cash") kickDrawer();
      setSuccess({ orderNumber: res.orderNumber, awarded: res.awarded });
      dispatch({ type: "clear" });
      setCustomer(null);
      setDiscount(0);
      setDiscountPct(null);
      setAdjust(null);
      setExtras([]);
      setSerialInput("");
      setPayMethod("cash");
      setOrderType("takeaway");
      setTableNo("");
      setOrderNote("");
    } catch (e) {
      // Never swallow the cause: an expired session used to surface as a
      // misleading "check your internet", so the cashier retried forever.
      console.error("[checkout]", e);
      if (isAuthError(e)) {
        setSessionDead(true);
        setErr("انتهت جلستك — سجّل الدخول من جديد. لم يُسجَّل أي طلب، وسلّتك محفوظة.");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(`تعذّر إتمام الطلب (${msg}). راجع «الطلبات» قبل إعادة المحاولة تفادياً للتكرار، أو حدّث الصفحة (F5).`);
      }
    } finally {
      checkoutBusyRef.current = false;
      setBusy(false);
    }
  }

  return (
    // minmax(0,1fr) + min-w-0: without them the scrollable pills row's intrinsic
    // width blows the grid past narrow POS screens (1024px) → horizontal cut.
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <FridayPrayerNotice />
      {/* The till keeps selling with the line down; this is the only thing that
          tells the cashier a ticket is not in the system yet. Spans both
          columns so it cannot be missed. */}
      {(lostSale || queued > 0) && (
        <div
          className={`lg:col-span-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
            lostSale ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"
          }`}
        >
          {lostSale
            ? "⚠️ تعذّر حفظ آخر طلب على الجهاز — سجّله على ورقة ولا تغلق الشاشة."
            : syncing
              ? `⏳ جارٍ رفع ${queued} طلباً محفوظاً…`
              : `📴 بلا إنترنت — ${queued} طلباً محفوظاً على الجهاز، سترتفع تلقائياً عند عودة الاتصال.`}
        </div>
      )}
      {/* items */}
      <section className="min-w-0 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {menu.map((c) => (
            <button
              key={c.name_ar}
              onClick={() => setActiveCat(c.name_ar)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                c.name_ar === (cat?.name_ar ?? "") ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
              }`}
            >
              {c.name_ar}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {cat?.items.map((it) => (
            <CashierItem key={it.id} item={it} category={cat?.name_ar} onAdd={(line) => dispatch({ type: "add", line })} />
          ))}
        </div>
      </section>

      {/* order panel */}
      <aside className="h-fit min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-20">
        <h2 className="text-lg font-bold">الطلب الحالي</h2>

        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            اختر الأصناف من القائمة.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  {l.flavor && <p className="text-xs text-muted-foreground">{l.flavor}</p>}
                  <p className="text-xs text-muted-foreground">{formatIqdLabel(l.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => dispatch({ type: "dec", key: l.key })} aria-label="إنقاص" className="rounded-full border border-border p-1 hover:bg-secondary">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{l.qty}</span>
                  <button onClick={() => dispatch({ type: "inc", key: l.key })} aria-label="زيادة" className="rounded-full border border-border p-1 hover:bg-secondary">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* loyalty */}
        <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-sm font-semibold">بطاقة الولاء</p>
          {customer ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{customer.name_ar ?? "زبون"}</p>
                <p className="text-xs text-muted-foreground">الرصيد: {customer.points} نقطة</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={redeem} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90">
                  استبدال مكافأة
                </button>
                <button onClick={() => setCustomer(null)} aria-label="إزالة" className="rounded-lg border border-border p-1.5 hover:bg-background">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="رقم البطاقة أو الهاتف"
                dir="ltr"
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={() => lookup(serialInput)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background">
                بحث
              </button>
              <button onClick={() => setScanOpen(true)} aria-label="مسح QR" className="rounded-lg bg-primary p-2 text-primary-foreground hover:opacity-90">
                <QrCode className="size-4" />
              </button>
            </div>
          )}
          {loyaltyMsg && <p className="text-xs text-muted-foreground">{loyaltyMsg}</p>}
        </div>

        {/* إضافة / خصم — two buttons; the chosen one opens a fixed panel underneath.
            The panel keeps one input in both discount modes so nothing shifts around. */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setAdjust((a) => (a === "extra" ? null : "extra"))}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${
                adjust === "extra" ? "bg-primary text-primary-foreground" : "bg-secondary/60 hover:bg-secondary"
              }`}
            >
              ➕ إضافة د.ع
              {extraTotal > 0 && <span className="ms-1 tabular-nums">(+{extraTotal.toLocaleString("en-US")})</span>}
            </button>
            <button
              type="button"
              onClick={() => setAdjust((a) => (a === "discount" ? null : "discount"))}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${
                adjust === "discount" ? "bg-primary text-primary-foreground" : "bg-secondary/60 hover:bg-secondary"
              }`}
            >
              ➖ خصم د.ع
              {appliedDiscount > 0 && <span className="ms-1 tabular-nums">(−{appliedDiscount.toLocaleString("en-US")})</span>}
            </button>
          </div>

          {adjust === "extra" && (
            <div className="space-y-1.5 rounded-xl bg-secondary/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <PriceInput value={extraPrice} onChange={setExtraPrice} compact />
                <button onClick={addExtra} aria-label="أضف" className="rounded-md bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground hover:opacity-90">
                  +
                </button>
              </div>
              {extras.length > 0 && (
                <ul className="space-y-0.5">
                  {extras.map((x, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">{x.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-primary">+{formatIqdLabel(x.price)}</span>
                        <button onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))} aria-label="حذف" className="rounded-md border border-border p-0.5 hover:bg-background">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {adjust === "discount" && (
            <div className="space-y-2 rounded-xl bg-secondary/60 px-3 py-2">
              <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDiscountPct(null)}
                  className={`rounded-md border px-2 py-1.5 transition ${
                    discountPct == null ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-background"
                  }`}
                >
                  رقم (مبلغ د.ع)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountPct((p) => p ?? 10)}
                  className={`rounded-md border px-2 py-1.5 transition ${
                    discountPct != null ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-background"
                  }`}
                >
                  نسبة %
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  dir="ltr"
                  value={discountPct != null ? discountPct || "" : discount || ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                    if (discountPct != null) setDiscountPct(Math.min(100, n));
                    else setDiscount(n);
                  }}
                  placeholder={discountPct != null ? "النسبة" : "المبلغ"}
                  className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-center text-base font-bold outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm font-bold text-muted-foreground">{discountPct != null ? "%" : "د.ع"}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  الخصم: <b className="tabular-nums text-foreground">−{formatIqdLabel(appliedDiscount)}</b>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">المجموع</span>
            <span>{formatIqdLabel(subtotal)}</span>
          </div>
          {extraTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الإضافات</span>
              <span className="text-primary">+{formatIqdLabel(extraTotal)}</span>
            </div>
          )}
          {appliedDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الخصم{discountPct != null ? ` (${discountPct}%)` : ""}</span>
              <span className="text-destructive">−{formatIqdLabel(appliedDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
            <span>الإجمالي</span>
            <span>{formatIqdLabel(total)}</span>
          </div>
        </div>

        {/* order note */}
        <input
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          placeholder="📝 ملاحظات: سكر قليل، بدون سكر…"
          maxLength={300}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {err && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{err}</p>
            {sessionDead && (
              <a
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                تسجيل الدخول من جديد
              </a>
            )}
          </div>
        )}

        {/* dine-in / takeaway */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary/60 p-1.5">
          <button
            onClick={() => {
              setOrderType("takeaway");
              setTableNo("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${orderType === "takeaway" ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
          >
            🥡 خارجي
          </button>
          <button
            onClick={() => setOrderType("dinein")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${orderType === "dinein" ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
          >
            🏠 داخل المحل
          </button>
        </div>
        {orderType === "dinein" && (
          <div className="flex flex-wrap gap-1.5">
            {tables.map((n) => (
              <button
                key={n}
                onClick={() => setTableNo(n)}
                className={`min-w-9 whitespace-nowrap rounded-lg border px-2 py-1.5 text-sm font-bold transition ${
                  tableNo === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary/60 p-1.5">
          <button
            onClick={() => setPayMethod("cash")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${payMethod === "cash" ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
          >
            💵 نقدي
          </button>
          <button
            onClick={() => setPayMethod("card")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${payMethod === "card" ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
          >
            💳 كي كارد
          </button>
        </div>
        <button
          onClick={checkout}
          disabled={busy || lines.length === 0}
          className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "جارٍ التنفيذ…" : payMethod === "cash" ? "دفع نقدي وإصدار الطلب" : "دفع كي كارد وإصدار الطلب"}
        </button>
      </aside>

      {/* scanner */}
      {scanOpen && <QrScanner onScan={onScanned} onClose={() => setScanOpen(false)} />}

      {/* success */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setSuccess(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-8" />
            </div>
            <h3 className="text-xl font-bold">تم الدفع</h3>
            <p className="mt-1 text-muted-foreground">رقم الطلب</p>
            <p className="my-2 text-4xl font-extrabold text-primary">{success.orderNumber}</p>
            {success.awarded > 0 && <p className="text-sm text-muted-foreground">أُضيفت {success.awarded} نقطة ولاء.</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
                <Printer className="size-4" />
                طباعة
              </button>
              <button onClick={() => setSuccess(null)} className="rounded-xl border border-border px-4 py-2.5 font-semibold hover:bg-secondary">
                طلب جديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* print-only checkout receipt */}
      {receipt && <Receipt data={receipt} />}
    </div>
  );
}

function CashierItem({ item, category, onAdd }: { item: MenuItemView; category?: string; onAdd: (line: Omit<Line, "qty">) => void }) {
  const [variantId, setVariantId] = useState<string | null>(item.variants[0]?.id ?? null);
  const [flavor, setFlavor] = useState<string | null>(item.flavors[0] ?? null);
  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = variant?.price ?? item.price;
  const displayName = variant ? `${item.name_ar} - ${variant.name_ar}` : item.name_ar;

  function add() {
    onAdd({
      key: `${item.id}|${variantId ?? ""}|${flavor ?? ""}`,
      itemId: item.id,
      name: displayName,
      variantId,
      flavor,
      unitPrice,
    });
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-3">
      <button onClick={add} className="text-right">
        <div className="flex items-center gap-2">
          <MenuIcon name={item.name_ar} category={category} className="size-8 shrink-0 text-primary/80" />
          <p className="font-semibold leading-tight">{item.name_ar}</p>
        </div>
        <p className="mt-0.5 text-sm font-bold text-primary">{formatIqdLabel(unitPrice)}</p>
      </button>
      {item.variants.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                v.id === variantId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
              }`}
            >
              {v.name_ar}
            </button>
          ))}
        </div>
      )}
      {item.flavors.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.flavors.map((f) => (
            <button
              key={f}
              onClick={() => setFlavor(f)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                f === flavor ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={add}
        className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
      >
        <Plus className="size-4" />
        إضافة
      </button>
    </div>
  );
}
