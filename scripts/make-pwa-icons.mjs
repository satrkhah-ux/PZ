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

// scale: cup group is drawn in a 512 box; maskable squeezes it into the 80% safe zone.
function brandSvg({ radius, scale }) {
  const s = scale;
  const t = (512 - 512 * s) / 2; // center the scaled group
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#6f4e37"/>
  <g transform="translate(${t} ${t}) scale(${s})">
    <path d="M203 106c-14 20 14 34 0 54M256 94c-14 20 14 34 0 54M309 106c-14 20 14 34 0 54"
          stroke="#f5e9dc" stroke-width="17" stroke-linecap="round" fill="none"/>
    <path d="M148 206h216v86a78 78 0 0 1-78 78h-60a78 78 0 0 1-78-78z" fill="#f5e9dc"/>
    <path d="M364 226h18a46 46 0 0 1 0 92h-18" stroke="#f5e9dc" stroke-width="19" fill="none"/>
    <rect x="138" y="394" width="236" height="19" rx="9.5" fill="#f5e9dc"/>
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
