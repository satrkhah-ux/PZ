import type { NextConfig } from "next";

// Managed hosts (Netlify / Vercel) emit their own serverless output, so we must
// NOT produce a standalone server there. The Docker/VPS path (`node server.js`)
// still needs standalone.
const isManagedHost =
  process.env.NETLIFY === "true" || process.env.VERCEL === "1" || process.env.RENDER === "true";

const nextConfig: NextConfig = {
  ...(isManagedHost ? {} : { output: "standalone" }),
  devIndicators: false,
  // MODERN_ONLY=1 turns a deployment into a dedicated menu site: its root goes
  // straight to the menu (the modern one — /menu is now the interactive default).
  async redirects() {
    return process.env.MODERN_ONLY === "1"
      ? [{ source: "/", destination: "/menu", permanent: false }]
      : [];
  },
};

export default nextConfig;
