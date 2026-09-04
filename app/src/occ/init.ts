// Loads and caches the OpenCASCADE.js WASM module. Kept isolated from
// three.js/React: this file only knows about OCCT, never about the scene.
//
// The .wasm binary (~63 MB) is served as a static asset from public/ and
// fetched same-origin at "/opencascade.wasm.wasm". We tried pointing this at
// jsdelivr's npm CDN instead (to keep the binary out of the repo), but
// jsdelivr enforces a per-file size cap well under 63 MB and returns a 403
// for it -- confirmed via the browser's Network tab (cf-cache-status: HIT,
// content-type: text/plain, tiny body). Same-origin avoids that entirely.
const WASM_SAME_ORIGIN_URL = "/opencascade.wasm.wasm";

let occPromise: Promise<any> | null = null;

export function loadOcc(): Promise<any> {
  if (!occPromise) {
    occPromise = (async () => {
      const factory = (await import("opencascade.js/dist/opencascade.wasm.js"))
        .default as any;
      return factory({
        locateFile(path: string) {
          return path.includes(".wasm") ? WASM_SAME_ORIGIN_URL : path;
        },
      });
    })();
  }
  return occPromise;
}
