/**
 * Per-item drink/food icons (أشكال الأصناف) — picked by item/category name.
 * Stroke-based, inherit `currentColor`, so they tint with their container.
 * Used wherever an item has no uploaded photo (menu, kiosk, cashier, admin).
 */

type IconKind =
  | "espresso" | "hotcup" | "turkish" | "choco" | "karak"
  | "iced" | "icetea" | "mojito" | "frappe" | "shake" | "smoothie"
  | "croissant" | "donut" | "cookie";

export function iconKindFor(itemName: string, categoryName?: string): IconKind {
  const n = itemName;
  const c = categoryName ?? "";
  if (n.includes("ميلك شيك")) return "shake";
  if (n.includes("سموذي")) return "smoothie";
  if (n.includes("فرابيه")) return "frappe";
  if (n.includes("موهيتو")) return "mojito";
  if (n.includes("آيس تي")) return "icetea";
  if (n.includes("كرواسون")) return "croissant";
  if (n.includes("دونات")) return "donut";
  if (n.includes("كوكيز")) return "cookie";
  if (n.includes("كرك") || n.includes("شاي")) return "karak";
  if (n.includes("تركية")) return "turkish";
  if (n.includes("شوكليت") || n.includes("شوكولاتة")) return "choco";
  if (n.startsWith("آيس") || c.includes("البارد")) return "iced";
  if (n.includes("إسبريسو")) return "espresso";
  return "hotcup";
}

const PATHS: Record<IconKind, React.ReactNode> = {
  espresso: (
    <>
      <path d="M13 21h20v5a10 9 0 0 1-20 0z" />
      <path d="M33 22h3.5a4.5 4.5 0 0 1 0 9H32" />
      <path d="M11 39h24" />
      <path d="M20 8c-2 3 2 5 0 9M27 8c-2 3 2 5 0 9" />
    </>
  ),
  hotcup: (
    <>
      <path d="M11 18h24v9a12 11 0 0 1-24 0z" />
      <path d="M35 20h3.5a5 5 0 0 1 0 10H34" />
      <path d="M10 41h26" />
      <path d="M23 22c-3 2-3 5 0 7c3-2 3-5 0-7z" />
      <path d="M19 6c-2 3 2 5 0 8M27 6c-2 3 2 5 0 8" />
    </>
  ),
  turkish: (
    <>
      <path d="M15 18h18l-2 12a7 7 0 0 1-14 0z" />
      <path d="M13 41h22" />
      <path d="M16 24h16" strokeDasharray="2.5 3" />
      <path d="M22 6c-2 3 2 5 0 8" />
    </>
  ),
  choco: (
    <>
      <path d="M13 16h20v18a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6z" />
      <path d="M33 19h3a4.5 4.5 0 0 1 0 9h-3" />
      <path d="M13 22l4 4 4-4 4 4 4-4 4 4" />
    </>
  ),
  karak: (
    <>
      <path d="M16 10c0 6 4 8 4 14s-4 8-4 14M32 10c0 6-4 8-4 14s4 8 4 14" />
      <path d="M16 10h16M16 38h16" />
      <path d="M18 26h12" />
    </>
  ),
  iced: (
    <>
      <path d="M14 14h20l-2.5 22a4 4 0 0 1-4 3.5h-7a4 4 0 0 1-4-3.5z" />
      <path d="M30 5l-5 11" />
      <rect x="18" y="19" width="5.5" height="5.5" rx="1" />
      <rect x="25" y="26" width="5.5" height="5.5" rx="1" />
    </>
  ),
  icetea: (
    <>
      <path d="M15 12h18l-2 25a4 4 0 0 1-4 3.5h-6a4 4 0 0 1-4-3.5z" />
      <circle cx="33" cy="13" r="5" />
      <path d="M18 22h12" strokeDasharray="2.5 3" />
    </>
  ),
  mojito: (
    <>
      <path d="M14 13h20l-2 24a4 4 0 0 1-4 3.5h-8a4 4 0 0 1-4-3.5z" />
      <path d="M24 12c-2-4 1-7 4-8c1 3 0 7-4 8zM28 13c1-4 5-5 8-4c-1 3-4 5-8 4z" />
      <path d="M18 27h12M19 33h10" strokeDasharray="2 3" />
    </>
  ),
  frappe: (
    <>
      <path d="M15 20h18l-2 17a4 4 0 0 1-4 3.5h-6a4 4 0 0 1-4-3.5z" />
      <path d="M15 20c0-4 3-6 5-5c0-4 6-4 8-1c3-1 6 2 5 6" />
      <path d="M29 6l-4 10" />
    </>
  ),
  shake: (
    <>
      <path d="M15 17h18l-2.5 20a4 4 0 0 1-4 3.5h-5a4 4 0 0 1-4-3.5z" />
      <path d="M14 17c1-4 4-5 6-4c1-3 7-3 8 0c3-1 5 1 5 4" />
      <path d="M29 5l-4 9" />
      <circle cx="24" cy="9" r="2" />
    </>
  ),
  smoothie: (
    <>
      <path d="M15 15h18l-2 22a4 4 0 0 1-4 3.5h-6a4 4 0 0 1-4-3.5z" />
      <path d="M28 5l-4 10" />
      <path d="M17 24c2-2 5-2 7 0s5 2 7 0" />
    </>
  ),
  croissant: (
    <>
      <path d="M8 30c2-8 10-16 18-16c8 0 14 6 14 12c0 3-2 5-5 5" />
      <path d="M8 30c0 4 3 6 7 6h20" />
      <path d="M18 15l3 9M31 15l-1 9" />
    </>
  ),
  donut: (
    <>
      <circle cx="24" cy="24" r="15" />
      <circle cx="24" cy="24" r="5.5" />
      <path d="M15 17l2 2M31 15l-1 3M33 30l-3-1M17 32l2-2" />
    </>
  ),
  cookie: (
    <>
      <path d="M24 9a15 15 0 1 0 15 15c-5 1-8-3-7-7c-4 1-8-3-8-8z" />
      <circle cx="19" cy="20" r="1.6" />
      <circle cx="24" cy="30" r="1.6" />
      <circle cx="30" cy="33" r="1.4" />
    </>
  ),
};

export function MenuIcon({
  name,
  category,
  className,
}: {
  name: string;
  category?: string;
  className?: string;
}) {
  const kind = iconKindFor(name, category);
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[kind]}
    </svg>
  );
}
