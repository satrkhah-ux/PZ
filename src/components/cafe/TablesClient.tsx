"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Armchair } from "lucide-react";
import { formatIqdLabel } from "@/lib/cafe/money";
import { listTableStatus } from "@/lib/cafe/table-actions";
import { SEATED_MINUTES, tableLabel, type TableStatus } from "@/lib/cafe/tables";

/** Live floor view: which tables are busy, paid-and-seated, or free. */
export function TablesClient() {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      try {
        const t = await listTableStatus();
        if (!stopped) {
          setTables(t);
          setLoaded(true);
        }
      } catch {
        /* transient */
      }
    }
    tick();
    const t = setInterval(tick, 15000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  const busy = tables.filter((t) => t.state === "pending").length;
  const seated = tables.filter((t) => t.state === "seated").length;
  const free = tables.filter((t) => t.state === "free").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Armchair className="size-5 text-primary" />
          الطاولات
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">🔴 طلب معلق: {busy}</span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-400">🟠 جالسون: {seated}</span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400">🟢 متاحة: {free}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        الطاولة تُعتبر مشغولة عند وجود طلب معلق، وبعد الدفع تبقى محجوزة {SEATED_MINUTES} دقيقة ثم تتحرر تلقائياً. تتحدث الشاشة كل 15 ثانية.
      </p>

      {!loaded ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">جارٍ التحميل…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <div
              key={t.table}
              className={`rounded-2xl border-2 p-4 text-center transition ${
                t.state === "pending"
                  ? "border-destructive bg-destructive/5"
                  : t.state === "seated"
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-border bg-card"
              }`}
            >
              <p className="text-2xl font-extrabold">{tableLabel(t.table)}</p>
              {t.state === "pending" && (
                <div className="mt-1 space-y-0.5 text-sm">
                  <p className="font-bold text-destructive">🔴 طلب معلق #{String(t.seq).padStart(3, "0")}</p>
                  <p className="text-muted-foreground">
                    منذ {t.sinceMin} د · {formatIqdLabel(t.subtotal ?? 0)}
                  </p>
                  <Link href="/orders" className="inline-block pt-1 text-xs font-semibold text-primary underline">
                    فتح الطلبات الواردة
                  </Link>
                </div>
              )}
              {t.state === "seated" && (
                <div className="mt-1 space-y-0.5 text-sm">
                  <p className="font-bold text-amber-600 dark:text-amber-400">🟠 مدفوع — زبون جالس</p>
                  <p className="text-muted-foreground">تتحرر بعد {t.freeInMin} د</p>
                </div>
              )}
              {t.state === "free" && <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">🟢 متاحة</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
