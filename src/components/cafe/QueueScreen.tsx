import { canViewQueue, listQueue, listShowcase } from "@/lib/cafe/queue-actions";
import { QueueDisplayClient } from "./QueueDisplayClient";

/**
 * Pickup screen, server-rendered FIRST.
 *
 * The device this ends up on is a TV nobody touches. If the first paint depended
 * on JavaScript and the TV's browser failed to run it, the screen would sit empty
 * forever and nobody is standing at the ceiling to notice. So the very first byte
 * already carries the real numbers, on any browser ever made.
 */
export async function QueueScreen({ displayKey }: { displayKey: string }) {
  // Authorization is checked HERE, not inside listQueue: a fetch that throws for
  // an unauthorized visitor, combined with any reload guard, is an endless reload
  // loop on a public URL.
  if (!(await canViewQueue(displayKey))) {
    return (
      <main dir="rtl" className="flex h-dvh items-center justify-center p-8" style={{ background: "radial-gradient(120% 90% at 50% -10%, #1b1009, #120a05 70%)", color: "#f6ead9" }}>
        <div className="max-w-md rounded-3xl p-8 text-center" style={{ border: "1px solid rgba(209,139,74,.35)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="بيزارا كافيه" style={{ height: 84, width: "auto", margin: "0 auto", objectFit: "contain" }} />
          <p className="mt-4 text-lg font-bold">شاشة الاستلام</p>
          <p className="mt-2 text-sm leading-7" style={{ color: "rgba(246,234,217,.6)" }}>
            هذا الرابط يحتاج مفتاح عرض صحيح. راجع الإدارة للحصول على الرابط الكامل.
          </p>
        </div>
      </main>
    );
  }

  // A failure here must degrade to an empty board, never to a red error page that
  // would stay frozen on the wall all night.
  const [rows, showcase] = await Promise.all([
    listQueue().catch(() => []),
    listShowcase().catch(() => []),
  ]);
  return <QueueDisplayClient initialRows={rows} showcase={showcase} />;
}
