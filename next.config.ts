import type { NextConfig } from "next";

// Managed hosts (Netlify / Vercel) emit their own serverless output, so we must
// NOT produce a standalone server there. The Docker/VPS path (`node server.js`)
// still needs standalone.
const isManagedHost =
  process.env.NETLIFY === "true" || process.env.VERCEL === "1" || process.env.RENDER === "true";

// Which build this is. Netlify sets COMMIT_REF; everywhere else it stays "dev",
// so the «يتوفر تحديث» check never fires locally. The SAME value is baked into
// the server and the client of one build, so a mismatch can only mean the client
// is running an older deploy than the server now serving it.
const BUILD_ID = process.env.COMMIT_REF?.slice(0, 7) ?? "dev";

const nextConfig: NextConfig = {
  ...(isManagedHost ? {} : { output: "standalone" }),
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  devIndicators: false,
  // Root routing for MODERN_ONLY moved to src/proxy.ts so it can see the session
  // (config redirects run before the proxy and would send logged-in staff who
  // open the bare domain to /menu instead of their dashboard).
  // /img/* → storage (same path the netlify.toml edge proxy serves in prod);
  // this rewrite covers local dev and any Node host.
  async rewrites() {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return supa
      ? [{ source: "/img/:path*", destination: `${supa}/storage/v1/object/public/menu/:path*` }]
      : [];
  },
};

export default nextConfig;
