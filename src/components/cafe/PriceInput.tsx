"use client";

/** Fast IQD price entry: type the thousands, then tap the last-3-digits button.
 *  Enforces multiples of 250 (000 / 250 / 500 / 750) so staff don't type the
 *  trailing digits every time. `value`/`onChange` are the full integer dinars.
 *  `compact` is the one-line variant used inside the cashier's side panel. */
const REMAINDERS = [0, 250, 500, 750] as const;

export function PriceInput({ value, onChange, compact = false }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  const v = Math.max(0, Math.round(value || 0));
  const thousands = Math.floor(v / 1000);
  const remainder = v % 1000;

  const input = (
    <input
      inputMode="numeric"
      value={thousands || ""}
      onChange={(e) => {
        const t = Math.max(0, Math.floor(Number(e.target.value.replace(/[^\d]/g, "")) || 0));
        onChange(t * 1000 + remainder);
      }}
      placeholder="الألوف"
      dir="ltr"
      className={
        compact
          ? "w-16 rounded-md border border-input bg-background px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
          : "w-20 rounded-lg border border-input bg-background px-3 py-2 text-center outline-none focus:ring-2 focus:ring-ring"
      }
    />
  );

  const buttons = (
    <div className="flex gap-1">
      {REMAINDERS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(thousands * 1000 + r)}
          className={`rounded-md border font-bold tabular-nums transition ${compact ? "px-2 py-1 text-xs" : "rounded-lg px-2.5 py-2 text-sm"} ${
            remainder === r ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
          }`}
        >
          {r === 0 ? "000" : r}
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {input}
        {buttons}
        {v > 0 && (
          <span className="text-xs text-muted-foreground">
            = <b className="tabular-nums text-foreground">{v.toLocaleString("en-US")}</b>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {input}
        <span className="px-0.5 text-sm text-muted-foreground">،</span>
        {buttons}
      </div>
      <p className="text-xs text-muted-foreground">
        = <b className="tabular-nums text-foreground">{v.toLocaleString("en-US")}</b> د.ع
      </p>
    </div>
  );
}
