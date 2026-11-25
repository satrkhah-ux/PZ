"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { CURRENT_RELEASE, dueSlot, slotKey } from "@/lib/cafe/whats-new";

/** The release notice, centred over the screen so it is read rather than
 *  scrolled past. Marked seen the moment it is shown, not when it is closed:
 *  a cashier who shuts it by reloading has still had their chance, and showing
 *  it again mid-rush would be worse than them missing it. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const slot = dueSlot(CURRENT_RELEASE, new Date(), (k) => window.localStorage.getItem(k) === "1");
        if (!slot) return;
        window.localStorage.setItem(slotKey(CURRENT_RELEASE, slot), "1");
        setOpen(true);
      } catch {
        /* storage blocked — simply never nag */
      }
    }, 1200); // let the screen paint first; a modal over a blank page reads as a crash
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={CURRENT_RELEASE.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-primary">
            <Sparkles className="size-5" />
            {CURRENT_RELEASE.title}
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {CURRENT_RELEASE.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:opacity-90"
        >
          فهمت
        </button>
      </div>
    </div>
  );
}
