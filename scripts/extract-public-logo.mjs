/**
 * One-shot: writes public/logo.jpg from src/logoData.ts embedded base64.
 * Run: node scripts/extract-public-logo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const raw = fs.readFileSync(path.join(root, "src", "logoData.ts"), "utf8");
const m = raw.match(/data:image\/jpeg;base64,([^"]+)/);
if (!m) {
  console.error("Could not parse JPEG base64 from logoData.ts");
  process.exit(1);
}
const out = path.join(root, "public", "logo.jpg");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(m[1], "base64"));
console.log("Wrote", out, `(${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
