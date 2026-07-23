import { NextResponse } from "next/server";

// Management PWA: installs as a separate «إدارة بيزارا» app (distinct id from
// the customer menu app) that opens straight on the dashboard. Public path —
// browsers fetch manifests credential-less, so it must bypass the auth gate
// (the pages it opens still require sign-in).
export function GET() {
  return NextResponse.json(
    {
      id: "/dashboard",
      name: "إدارة بيزارا كافيه",
      short_name: "إدارة بيزارا",
      description: "لوحة إدارة بيزارا كافيه — الطلبات والطاولات والتقارير",
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
      dir: "rtl",
      lang: "ar",
      background_color: "#ffffff",
      theme_color: "#2b1a10",
      icons: [
        { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
