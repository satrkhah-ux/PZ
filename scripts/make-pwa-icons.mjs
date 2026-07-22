// Generates the PWA / favicon icon set from an inline brand SVG (coffee cup on
// an espresso tile). Replace the SVG when the owner supplies a real logo.
// Run: node scripts/make-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });

// The Pizzara Coffee mark (matches src/components/cafe/Logo.tsx): dark espresso
// disc, golden cup whose handle forms the "P", steam, saucer swoosh.
// scale: maskable squeezes the artwork into the 80% safe zone.
function brandSvg({ radius, scale }) {
  const s = scale;
  const t = (512 - 512 * s) / 2; // center the scaled group
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#2b1a10"/>
  <g transform="translate(${t} ${t}) scale(${s})" fill="none" stroke="#d18b4a" stroke-width="22" stroke-linecap="round">
    <path d="M292 92c-26 30 16 46-8 78"/>
    <path d="M336 106c-20 24 12 38-6 62"/>
    <path d="M118 234h236c4 66-50 112-118 112s-120-46-118-112z" fill="#d18b4a" stroke="none"/>
    <path d="M368 322V150" stroke-width="24"/>
    <path d="M368 158h26a48 48 0 0 1 0 96h-26" stroke-width="24"/>
    <path d="M96 372c52 34 262 32 322-16" stroke-width="20"/>
  </g>
</svg>`);
}

const normal = brandSvg({ radius: 100, scale: 1 });
const maskable = brandSvg({ radius: 0, scale: 0.72 }); // full-bleed bg, content in safe zone

await sharp(normal).resize(192, 192).png().toFile(join(out, "icon-192.png"));
await sharp(normal).resize(512, 512).png().toFile(join(out, "icon-512.png"));
await sharp(maskable).resize(512, 512).png().toFile(join(out, "icon-maskable-512.png"));
await sharp(brandSvg({ radius: 0, scale: 0.9 })).resize(180, 180).png().toFile(join(out, "apple-touch-icon.png"));
// Next.js auto-serves src/app/icon.png as the favicon.
await sharp(normal).resize(512, 512).png().toFile(join(root, "src", "app", "icon.png"));

console.log("✓ icons written: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png + src/app/icon.png");
