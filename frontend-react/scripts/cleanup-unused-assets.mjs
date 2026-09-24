#!/usr/bin/env node
/**
 * Déplace vers public/_unused/ tous les fichiers de public/assets/ qui ne sont
 * PAS référencés dans le code source. Réversible (Move, pas Delete).
 *
 * Après vérification que le site fonctionne, tu peux supprimer public/_unused/
 * en toute confiance.
 *
 * Usage: node scripts/cleanup-unused-assets.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PUBLIC_DIR = path.join(ROOT, "public");
const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");
const TRASH_DIR = path.join(PUBLIC_DIR, "_unused");

// Sources referenced anywhere in src/ — kept alive.
const KEEP = new Set([
  "brand/vichy-pattern.svg",
  "brand/motif-spaghetti.svg",
  "brand/motif-tomato.svg",
  "brand/motif-basil.svg",
  "brand/palm-shadow-diffuse.png",
  "brand/box-pomodoro-steam.png",
  "pasta-by-galatee/menu-spaghetti-pomodoro-v1.png",
  "pasta-by-galatee/menu-spaghetti-carbonara-v1.png",
  "pasta-by-galatee/menu-tiramisu-v1.png",
  "menu-tagliolini.png",
  "menu-ravioli.png",
  "menu-tortelli.png",
]);

// Also keep every generated *-640.webp / *-960.webp / *-1280.webp variant
// alongside every kept source (produced by optimize-images.mjs).
const KEEP_WEBP_VARIANTS = true;

async function walk(dir, base = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(full, rel)));
    else out.push({ full, rel });
  }
  return out;
}

function shouldKeep(rel) {
  if (KEEP.has(rel)) return true;
  if (KEEP_WEBP_VARIANTS && rel.endsWith(".webp")) {
    // If it's a variant of a kept source, keep it.
    // Example: brand/box-pomodoro-steam-960.webp -> brand/box-pomodoro-steam.png
    const m = rel.match(/^(.*)-(\d+)\.webp$/);
    if (m) {
      const stem = m[1];
      return (
        KEEP.has(`${stem}.png`) ||
        KEEP.has(`${stem}.jpg`) ||
        KEEP.has(`${stem}.jpeg`)
      );
    }
  }
  return false;
}

async function main() {
  const files = await walk(ASSETS_DIR);
  const toMove = files.filter((f) => !shouldKeep(f.rel));

  let bytes = 0;
  for (const f of toMove) bytes += (await fs.stat(f.full)).size;

  console.log(`Files in public/assets : ${files.length}`);
  console.log(`Kept                   : ${files.length - toMove.length}`);
  console.log(`To move to _unused/    : ${toMove.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log("");

  for (const f of toMove) {
    const dest = path.join(TRASH_DIR, "assets", f.rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(f.full, dest);
    console.log(`  moved: ${f.rel}`);
  }

  console.log("\n✔ Done. Verify the site still works, then delete public/_unused/ manually.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
