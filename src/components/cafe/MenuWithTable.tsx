"use client";

import { useSearchParams } from "next/navigation";
import { TabletMenuClient } from "./TabletMenuClient";
import type { MenuCategoryView } from "@/lib/cafe/menu-data";

/** Reads the table number (?t=) in the BROWSER so /menu can stay a static,
 *  CDN-served page. Must sit under a Suspense boundary; the fallback renders the
 *  same menu with no table, so the first paint is instant and the table pill
 *  appears the moment the client hydrates. Every NFC/QR link keeps working. */
export function MenuWithTable({ menu, offers }: { menu: MenuCategoryView[]; offers: Record<string, number> }) {
  const table = useSearchParams().get("t")?.trim() || null;
  return <TabletMenuClient menu={menu} table={table} channel="qr" offers={offers} />;
}
