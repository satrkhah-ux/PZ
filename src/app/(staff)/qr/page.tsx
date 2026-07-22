import QRCode from "qrcode";
import { headers } from "next/headers";
import { PrintButton } from "@/components/cafe/PrintButton";

export const dynamic = "force-dynamic";

const TABLE_COUNT = 12;

/** Printable QR stickers: the general menu QR + one per table (?t=N).
 *  Defaults to the current origin; pass ?base=https://your-domain after deploy. */
export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string; path?: string }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = typeof sp.base === "string" && sp.base.startsWith("http") ? sp.base.replace(/\/$/, "") : `${proto}://${host}`;
  // ?path=modern → interactive-menu stickers; default follows the site's purpose.
  const modern = sp.path ? sp.path === "modern" : process.env.MODERN_ONLY === "1";
  const menuPath = modern ? "/menu/modern" : "/menu";

  const opts = { margin: 1, color: { dark: "#42301f", light: "#ffffff" } };
  const menuQr = await QRCode.toDataURL(`${base}${menuPath}`, { ...opts, width: 380 });
  const tables = await Promise.all(
    Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map(async (n) => ({
      n,
      qr: await QRCode.toDataURL(`${base}${menuPath}?t=${n}`, { ...opts, width: 300 }),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">رموز QR</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {base}/menu
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            بعد النشر على الإنترنت أضف <code dir="ltr">?base=https://رابطك</code> لتوليد رموز بالرابط النهائي.
          </p>
        </div>
        <PrintButton label="طباعة الملصقات" />
      </div>

      {/* main menu sticker */}
      <div className="mx-auto w-fit rounded-3xl border-2 border-primary bg-card p-6 text-center">
        <h2 className="text-2xl font-extrabold text-primary">بيزارا كافيه</h2>
        <p className="mb-3 text-sm text-muted-foreground">امسح الرمز لتصفّح المنيو والطلب</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={menuQr} alt="منيو QR" className="mx-auto size-72" />
      </div>

      {/* table stickers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {tables.map((t) => (
          <div key={t.n} className="break-inside-avoid rounded-2xl border-2 border-primary bg-card p-4 text-center">
            <p className="font-extrabold text-primary">بيزارا كافيه</p>
            <p className="mb-2 text-lg font-bold">طاولة {t.n}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`طاولة ${t.n}`} className="mx-auto size-40" />
            <p className="mt-1.5 text-xs text-muted-foreground">امسح للطلب من طاولتك</p>
          </div>
        ))}
      </div>
    </div>
  );
}
