// Loads and caches the OpenCASCADE.js WASM module. Kept isolated from
// three.js/React: this file only knows about OCCT, never about the scene.
let occPromise: Promise<any> | null = null;

export function loadOcc(): Promise<any> {
  if (!occPromise) {
    occPromise = (async () => {
      const factory = (await import("opencascade.js/dist/opencascade.wasm.js"))
        .default as any;
      return factory({
        locateFile(path: string) {
          if (path.endsWith(".wasm")) return "/opencascade.wasm.wasm";
          return path;
        },
      });
    })();
  }
  return occPromise;
}
