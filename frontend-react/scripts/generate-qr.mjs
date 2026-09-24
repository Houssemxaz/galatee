import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "qr");

const url = process.argv[2] || "https://pastabygalatee.dz/table";

// PNG haute résolution (1200×1200) — palette olive/paper
const pngOpts = {
  errorCorrectionLevel: "H",
  type: "png",
  width: 1200,
  margin: 2,
  color: {
    dark: "#2F3821",
    light: "#F5EFE4",
  },
};

// SVG vectoriel (impression illimitée)
const svgOpts = { errorCorrectionLevel: "H", type: "svg", margin: 2, color: pngOpts.color };

const pngPath = resolve(OUT_DIR, "galatee-table-qr.png");
const svgPath = resolve(OUT_DIR, "galatee-table-qr.svg");

await QRCode.toFile(pngPath, url, pngOpts);
const svg = await QRCode.toString(url, svgOpts);
writeFileSync(svgPath, svg, "utf8");

console.log(`OK — QR généré pour ${url}`);
console.log(`  ${pngPath}`);
console.log(`  ${svgPath}`);
