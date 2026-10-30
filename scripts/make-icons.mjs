// Renders the PWA icons from inline SVG with the preinstalled Playwright Chromium.
// Usage: node scripts/make-icons.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const house = (inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${inset ? 0 : 112}" fill="#2f6fcb"/>
  <g transform="translate(256 262) scale(${inset ? 0.62 : 0.78}) translate(-256 -256)">
    <path d="M96 236 256 104l160 132v172a16 16 0 0 1-16 16H112a16 16 0 0 1-16-16z" fill="#ffffff"/>
    <path d="M216 424v-96h80v96" fill="#bfe9d1"/>
    <circle cx="256" cy="232" r="30" fill="#bfe9d1"/>
  </g>
</svg>`;

const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, inset] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${house(inset).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true });
}
await browser.close();
console.log("icons written");
