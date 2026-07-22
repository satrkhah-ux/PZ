import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { CafeUIProvider } from "@/components/CafeUIProvider";
import { getPublicSupabaseConfig } from "@/lib/supabase/constants";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بيزارا كافيه — Pizzara",
  description: "منيو ونظام طلبات وولاء بيزارا كافيه.",
  manifest: "/manifest.webmanifest",
  // favicon comes from src/app/icon.png (Next serves it automatically)
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "بيزارا كافيه",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6f4e37",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Public Supabase config, read at RUNTIME and injected so the browser gets it
  // even when NEXT_PUBLIC_* were not baked at build time (Netlify/VPS deploys).
  // These are public values (anon key + URL) — safe to embed in the HTML.
  const publicEnv = getPublicSupabaseConfig();
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__=${JSON.stringify({
              supabaseUrl: publicEnv?.url ?? "",
              supabaseAnonKey: publicEnv?.anonKey ?? "",
            })}`,
          }}
        />
        <CafeUIProvider>{children}</CafeUIProvider>
      </body>
    </html>
  );
}
