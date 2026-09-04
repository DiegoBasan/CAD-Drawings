# CAD-Drawings

Visor CAD web para crear guías de ensamble paso a paso (estilo manual de LEGO / dibujo isométrico de SolidWorks), a partir de modelos importados.

## Qué hace hoy

- **Importar CAD real**: `.step`/`.stp` e `.iges`/`.igs` vía `opencascade.js` (OCCT compilado a WASM) — geometría B-Rep de verdad, no solo mallas. También `.stl`, `.obj`, `.glb`/`.gltf`. Cada cuerpo/mesh se separa en una **pieza** independiente y movible; en un STEP de ensamble, cada sub-compound no anidado se trata como una pieza rígida (ver `occ/stepImport.ts`).
- **Dos pestañas independientes**: "Ensamble 3D" (edición libre: orbitar, mover piezas, elegir vista/modo de render) y "Dibujo 2D" (canvas de fondo blanco, sin cámara 3D libre, donde se componen vistas ya congeladas).
- **Mover piezas** individualmente arrastrando con el mouse — solo en la pestaña 3D.
- **Vistas de cámara**: isométrica, frontal, posterior, izquierda, derecha, superior, inferior (convención Z-up, cámara ortográfica).
- **Modos de visualización**: color (shaded), rayos X, armazón (solo líneas, con oclusión — el sólido actúa de ocluyente invisible para que las aristas del lado lejano no se vean a través de la pieza), armazón rayos X (igual pero sin oclusión, totalmente transparente).
- **Cámara auto-encuadrada**: al importar, la cámara y la cuadrícula (pestaña 3D) se ajustan automáticamente al tamaño real del modelo.
- **Dibujos tipo SolidWorks**: en la pestaña 3D acomodas las piezas libremente. En la pestaña 2D creas uno o más **canvas** (hojas), y en cada uno **insertas vistas** (frontal, lateral, superior, isométrica...) — cada vista es una proyección ortográfica que congela el acomodo actual del ensamble 3D en ese instante. Varias vistas conviven en el mismo canvas, cada una es su propio recuadro que se puede **arrastrar y redimensionar** libremente dentro de la hoja (no hay cámara 3D compartida ni orbitable en este modo). Puedes seguir insertando más vistas y más canvas en cualquier momento.
- **Señalar piezas**: seleccionando una vista en el canvas 2D, el panel lateral lista sus piezas y permite asignar un color de contorno (`outlineColor`) distinto por pieza para resaltarla.
- **Flechas**: con una vista seleccionada, activa la herramienta de flecha y haz clic en el origen y luego en el destino (sobre cualquier pieza visible de esa vista) para dibujar una flecha de instrucción.

## Qué falta / roadmap

- Cada vista insertada sigue siendo un mini-render 3D congelado (su propia escena/cámara three.js), no un canvas 2D vectorial (SVG/Canvas) independiente. Funciona bien para lo pedido (arrastrar vistas, flechas, contornos), pero anotaciones más "de drawing real" (texto, cotas, líneas de referencia) pedirían pasar a coordenadas de pantalla puras.
- Las aristas de piezas STEP se dibujan hoy desde la malla triangulada (`THREE.EdgesGeometry`), no desde las curvas B-Rep reales — los círculos/filetes se ven poligonales en vez de perfectamente suaves. El siguiente paso natural es samplear `BRepAdaptor_Curve` por arista y dibujar esas polilíneas en vez de depender del umbral de ángulo de la malla.
- Guardar/cargar proyecto (`.json` con piezas + poses + canvas + vistas).
- Snap a un solo eje al arrastrar (Shift), rotación de piezas (arcball / spin) en la pestaña 3D.
- Editar/mover el punto de una flecha ya creada (hoy solo se puede borrar y volver a trazar).
- Zoom/pan del propio canvas 2D (hoy es un lienzo de tamaño fijo con scroll).

## Arquitectura

```
app/src/
  types/domain.ts     # modelo de datos: Part, Pose, Sheet, ViewInstance, PartStepState, Arrow
  assembly/store.ts    # estado global (zustand): piezas/poses (3D), tab activa, hojas/vistas (2D)
  occ/
    init.ts             # carga/cachea la instancia WASM de OpenCASCADE una sola vez
    stepImport.ts         # lee STEP/IGES, separa el compound en piezas "rígidas"
    tessellate.ts          # B-Rep -> Float32Array de posiciones/normales/índices (Part)
  importers/loadModel.ts  # STL/OBJ/glTF -> Part[] (separa cuerpos, recentra origen) + despacha a occ/ para STEP/IGES
  scene/
    partVisual.ts        # helpers compartidos: construir/actualizar mesh+edges de una Part, aplicar modo de render
    bounds.ts             # bounding sphere del ensamble (o de una vista congelada) para auto-encuadrar cámara
    viewPresets.ts          # direcciones de cámara para cada vista (iso/front/top/...)
    Viewport.tsx             # pestaña 3D: escena libre, OrbitControls, picking, drag de piezas
    DrawingViewBox.tsx        # una vista insertada en el canvas 2D: su propio mini-render congelado, arrastrable/redimensionable, flechas
  components/
    Toolbar.tsx          # importar, cambiar de pestaña, (en 3D) elegir vista/modo de render
    PartsPanel.tsx        # pestaña 3D: lista de piezas, visibilidad, color
    DrawingCanvas.tsx      # pestaña 2D: pestañas de hojas, botones "+ vista", area blanca con las DrawingViewBox
    ViewInspector.tsx       # panel lateral en 2D: direccion/modo de la vista activa, flechas, color de contorno por pieza
```

Separación clave (igual que el proyecto de referencia): `occ/` no sabe nada de three.js ni de React — solo produce arrays planos de geometría a partir del kernel OCCT. `scene/partVisual.ts` es la única pieza que construye objetos three.js a partir de esos datos, y la comparten tanto `Viewport.tsx` (3D) como `DrawingViewBox.tsx` (cada vista del 2D).

### Nota sobre el WASM de OpenCASCADE

El binario `opencascade.wasm.wasm` (~63 MB) se sirve mismo-origen en `/opencascade.wasm.wasm` — `occ/init.ts` se lo indica al loader de Emscripten vía `locateFile`. **No está commiteado al repo**: `scripts/copy-wasm.mjs` lo copia a `app/public/` automáticamente vía `postinstall` justo después de `npm install` (desde `node_modules/opencascade.js/dist/opencascade.wasm.wasm`). Se probaron dos alternativas que fallaron antes de llegar a esto:

- Un CDN (jsdelivr): aplica un límite de tamaño de archivo por debajo de 63 MB y responde 403 para este binario (confirmado con la pestaña Network: `cf-cache-status: HIT`, `content-type: text/plain`, body de ~49 bytes).
- Commitear el binario directo en `app/public/`: git/GitHub avisan que supera su tamaño recomendado (50 MB), y herramientas que importan/clonan el repo (StackBlitz incluido) pueden truncarlo o devolver una página de error en su lugar — eso produce exactamente el síntoma visto (`WebAssembly.instantiate(): expected magic word... found File`, es decir el `fetch()` recibió texto de error en vez del binario real).

Regenerarlo en `postinstall` evita ambos problemas: nunca viaja por git, así que no hay nada que un import/clone pueda truncar. `vite.config.ts` además excluye `opencascade.js` del pre-bundling de dependencias (`optimizeDeps.exclude`), porque esbuild puede reescribir el código glue de Emscripten en dev de una forma que rompe la detección de `locateFile`.

## Desarrollo

```bash
cd app
npm install
npm run dev
```
