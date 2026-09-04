// Loads and caches the OpenCASCADE.js WASM module. Kept isolated from
// three.js/React: this file only knows about OCCT, never about the scene.
//
// The .wasm binary (~63 MB) is fetched from a CDN mirror of the npm package
// instead of being committed to this repo or served from public/: GitHub's
// contents API (which tools like StackBlitz's "import from GitHub" use)
// refuses files that large, and it bloats every clone. jsdelivr serves the
// exact same bytes published to npm, unpacked, for any package regardless
// of size.
const OCC_VERSION = "1.1.1";
const WASM_CDN_URL = `https://cdn.jsdelivr.net/npm/opencascade.js@${OCC_VERSION}/dist/opencascade.wasm.wasm`;

let occPromise: Promise<any> | null = null;

export function loadOcc(): Promise<any> {
  if (!occPromise) {
    occPromise = (async () => {
      const factory = (await import("opencascade.js/dist/opencascade.wasm.js"))
        .default as any;
      return factory({
        locateFile(path: string) {
          const url = path.includes(".wasm") ? WASM_CDN_URL : path;
          // eslint-disable-next-line no-console
          console.log("[occ] locateFile", { path, url });
          return url;
        },
      });
    })();
  }
  return occPromise;
}
