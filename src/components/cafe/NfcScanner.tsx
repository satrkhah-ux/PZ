"use client";

import { useEffect, useRef, useState } from "react";
import { Nfc, ScanLine } from "lucide-react";
import { isMenuUrl, tableFromUrl } from "@/lib/cafe/nfc-url";
import { tableLabel } from "@/lib/cafe/tables";

type Hit = { at: number; url: string; table: string | null; menu: boolean };

/** Reads NFC tags and says which table each one opens.
 *
 *  Web NFC writes to whatever tag is presented, so writing a batch in one go can
 *  put a single table's URL onto several tags — which is how every table order
 *  started arriving as one number. There is no way to fix that from the server:
 *  the wrong table is physically on the sticker. This lets the counter tap each
 *  tag and see, in one second, which ones are wrong. */
export function NfcScanner() {
  const [state, setState] = useState<"idle" | "scanning" | "unsupported" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function start() {
    setErr(null);
    if (!("NDEFReader" in window)) {
      setState("unsupported");
      return;
    }
    try {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      // @ts-expect-error Web NFC is not in the TS DOM lib yet
      const reader = new NDEFReader();
      await reader.scan({ signal: controller.signal });
      reader.onreading = (event: { message: { records: { recordType: string; data: BufferSource }[] } }) => {
        const decoder = new TextDecoder();
        for (const record of event.message.records) {
          if (record.recordType !== "url" && record.recordType !== "text") continue;
          const url = decoder.decode(record.data);
          setHits((prev) => [{ at: Date.now(), url, table: tableFromUrl(url), menu: isMenuUrl(url) }, ...prev].slice(0, 12));
        }
      };
      setState("scanning");
    } catch (e) {
      setState("error");
      setErr((e as Error).message);
    }
  }

  function stop() {
    abort.current?.abort();
    abort.current = null;
    setState("idle");
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/50 bg-card p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ScanLine className="size-5 text-primary" />
            افحص بطاقات الطاولات
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            قرّب هاتفك من بطاقة كل طاولة — سيخبرك أي طاولة مكتوبة عليها فعلاً. (أندرويد + Chrome)
          </p>
        </div>
        {state === "scanning" ? (
          <button onClick={stop} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
            إيقاف الفحص
          </button>
        ) : (
          <button onClick={start} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            <Nfc className="size-4" />
            ابدأ الفحص
          </button>
        )}
      </div>

      {state === "scanning" && (
        <p className="mt-3 animate-pulse text-sm font-semibold text-primary">جاهز — قرّب البطاقة…</p>
      )}
      {state === "unsupported" && (
        <p className="mt-3 text-sm text-destructive">
          هذا المتصفّح لا يقرأ NFC. افتح الصفحة من هاتف أندرويد بمتصفّح Chrome، أو افحص البطاقة بتطبيق «NFC Tools».
        </p>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      {hits.length > 0 && (
        <ul className="mt-4 space-y-2">
          {hits.map((h) => (
            <li
              key={h.at}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
              style={{
                background: h.menu && h.table ? "rgba(16,163,74,.10)" : "rgba(220,38,38,.10)",
                border: `1px solid ${h.menu && h.table ? "rgba(16,163,74,.35)" : "rgba(220,38,38,.35)"}`,
              }}
            >
              <span className="text-lg font-extrabold">
                {h.menu ? (h.table ? tableLabel(h.table) : "منيو عام — بلا رقم طاولة") : "بطاقة لا تخصّ المنيو"}
              </span>
              <span dir="ltr" className="max-w-[55%] truncate text-[11px] text-muted-foreground">
                {h.url}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
