// Copies the OpenCASCADE WASM binary into public/ after npm install, so it
// is served same-origin at /opencascade.wasm.wasm (see src/occ/init.ts).
// The 63MB binary is intentionally NOT committed to the repo: a git blob
// that large is exactly the kind of thing tools that import/clone the repo
// (StackBlitz included) can truncate or mishandle, which surfaces as
// "WebAssembly.instantiate(): expected magic word ... found File" — the
// fetch got an error page instead of the real binary. Regenerating it
// locally from node_modules on every install sidesteps that entirely.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.join(
  root,
  "node_modules/opencascade.js/dist/opencascade.wasm.wasm"
);
const destDir = path.join(root, "public");
const dest = path.join(destDir, "opencascade.wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-wasm] opencascade.js no esta instalado todavia, skip.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-wasm] copiado a ${path.relative(root, dest)}`);
