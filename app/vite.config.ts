import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // opencascade.js ships hand-written Emscripten glue (not a normal ESM
    // module): letting esbuild pre-bundle/rewrite it in dev breaks its
    // internal module-factory detection and can silently swap out the
    // locateFile() codepath, so the .wasm fetch goes to the wrong URL.
    exclude: ["opencascade.js"],
  },
})
