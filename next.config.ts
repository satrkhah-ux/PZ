import type { NextConfig } from "next";

// Netlify sets NETLIFY="true" during its build. There the @netlify/plugin-nextjs
// runtime emits its own serverless output, so we must NOT produce a standalone
// server. The Docker/VPS path (which runs `node server.js`) still needs standalone.
const isNetlify = process.env.NETLIFY === "true";

const nextConfig: NextConfig = {
  ...(isNetlify ? {} : { output: "standalone" }),
  devIndicators: false,
};

export default nextConfig;
