#!/usr/bin/env node
/**
 * Optimise les images du site :
 *   - convertit chaque source .png en WebP (qualité 82) et AVIF (qualité 55) OPTIONNEL
 *   - génère les tailles 640, 960, 1280 pour srcset
 *   - garde le PNG original pour fallback
 *
 * Usage: node scripts/optimize-images.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PUBLIC_DIR = path.join(ROOT, "public");

const SOURCES = [
  "assets/pasta-by-galatee/menu-spaghetti-pomodoro-v1.png",
  "assets/pasta-by-galatee/menu-spaghetti-carbonara-v1.png",
  "assets/pasta-by-galatee/menu-tiramisu-v1.png",
  "assets/menu-tagliolini.png",
  "assets/menu-ravioli.png",
  "assets/menu-tortelli.png",
  "assets/brand/box-pomodoro-steam.png",
  "assets/brand/palm-shadow-diffuse.png",
];

const SIZES = [640, 960, 1280];
const WEBP_QUALITY = 82;

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function processOne(relPath) {
  const abs = path.join(PUBLIC_DIR, relPath);
  const parsed = path.parse(abs);
  try {
    await fs.access(abs);
  } catch {
    console.log(`⏭  skip (not found): ${relPath}`);
    return { skipped: true };
  }

  const image = sharp(abs);
  const meta = await image.metadata();
  const originalSize = (await fs.stat(abs)).size;

  const results = [];
  const genSizes = SIZES.filter((s) => s < (meta.width || Infinity));
  if (genSizes.length === 0) genSizes.push(meta.width || 800);

  for (const width of genSizes) {
    const outPath = path.join(parsed.dir, `${parsed.name}-${width}.webp`);
    await sharp(abs)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toFile(outPath);
    const size = (await fs.stat(outPath)).size;
    results.push({ path: outPath, size, width });
  }

  console.log(`✓ ${relPath}  (${meta.width}×${meta.height}, ${fmtSize(originalSize)})`);
  for (const r of results) {
    const saving = (((originalSize - r.size) / originalSize) * 100).toFixed(1);
    console.log(`     → ${path.basename(r.path)} — ${r.width}w — ${fmtSize(r.size)} (−${saving}%)`);
  }

  return { originalSize, generated: results };
}

async function main() {
  let originalTotal = 0;
  let webpTotalLargest = 0;

  console.log("Converting PNG → WebP (srcset 640/960/1280w)…\n");
  for (const src of SOURCES) {
    const r = await processOne(src);
    if (r?.originalSize) {
      originalTotal += r.originalSize;
      const largest = r.generated.reduce((max, g) => (g.size > max ? g.size : max), 0);
      webpTotalLargest += largest;
    }
  }

  console.log("\n════════════════════════════════════════════");
  console.log(`Originals total    : ${fmtSize(originalTotal)}`);
  console.log(`Largest WebP tier  : ${fmtSize(webpTotalLargest)}`);
  const saved = originalTotal - webpTotalLargest;
  const pct = ((saved / originalTotal) * 100).toFixed(1);
  console.log(`Saved (largest)    : ${fmtSize(saved)} (${pct}%)`);
  console.log("════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
