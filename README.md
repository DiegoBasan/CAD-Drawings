# CAD-Drawings

Visor CAD web para crear guías de ensamble paso a paso (estilo manual de LEGO / dibujo isométrico de SolidWorks), a partir de modelos importados.

## Qué hace hoy

- **Importar CAD real**: `.step`/`.stp` e `.iges`/`.igs` vía `opencascade.js` (OCCT compilado a WASM) — geometría B-Rep de verdad, no solo mallas. También `.stl`, `.obj`, `.glb`/`.gltf`. Cada cuerpo/mesh se separa en una **pieza** independiente y movible; en un STEP de ensamble, cada sub-compound no anidado se trata como una pieza rígida (ver `occ/stepImport.ts`).
- **Mover piezas** individualmente arrastrando con el mouse (drag sobre un plano perpendicular a la cámara) — solo en el editor 3D del ensamble, no dentro de un dibujo.
- **Vistas de cámara**: isométrica, frontal, posterior, izquierda, derecha, superior, inferior (convención Z-up, cámara ortográfica).
- **Modos de visualización**: color (shaded), rayos X, armazón (solo líneas / wireframe), armazón rayos X.
- **Cámara auto-encuadrada**: al importar, la cámara y la cuadrícula se ajustan automáticamente al tamaño real del modelo (una pieza de 5cm y un ensamble de 2m usan escalas de rejilla muy distintas).
- **Dibujos (flujo tipo SolidWorks)**: primero acomodas todas las piezas libremente en el editor 3D. Luego, en el panel "Dibujos", **insertas una vista** que congela ese acomodo como una proyección ortográfica fija (como insertar una vista en un drawing de SolidWorks) — dirección de cámara y modo de render incluidos. Mientras estás dentro de una vista de dibujo la cámara queda bloqueada (no rotable, sí zoom/pan) y no se pueden arrastrar piezas: solo anotar. Un dibujo puede tener varias vistas (para una guía paso a paso, cada vista es un "paso").
- **Señalar piezas**: dentro de una vista de dibujo, cualquier pieza puede recibir un color de contorno (`outlineColor`) distinto para resaltarla, independiente del color base de la pieza.
- **Flechas**: dentro de una vista de dibujo, activa la herramienta de flecha y haz clic en el punto de origen y luego en el destino (sobre cualquier pieza visible) para dibujar una flecha de instrucción; se listan y se pueden borrar desde el panel del dibujo.

## Qué falta / roadmap

- Las flechas y el color de contorno todavía se resuelven con raycasting sobre la escena 3D (la cámara está bloqueada pero sigue siendo una escena 3D real, no un canvas 2D independiente). Un canvas 2D propio (SVG/Canvas superpuesto, guardando coordenadas de pantalla en vez de mundo) daría anotaciones que se comportan de forma más parecida a un drawing real de SolidWorks (p. ej. texto, cotas, líneas de referencia) — es el siguiente paso natural si esto se queda corto.
- Las aristas de piezas STEP se dibujan hoy desde la malla triangulada (`THREE.EdgesGeometry`), no desde las curvas B-Rep reales — los círculos/filetes se ven poligonales en vez de perfectamente suaves. El siguiente paso natural es samplear `BRepAdaptor_Curve` por arista (igual que el proyecto de referencia) y dibujar esas polilíneas en vez de depender del umbral de ángulo de la malla.
- Guardar/cargar proyecto (`.json` con piezas + poses + dibujos).
- Snap a un solo eje al arrastrar (Shift), rotación de piezas (arcball / spin), como en el proyecto de referencia.
- Editar/mover el punto de una flecha ya creada (hoy solo se puede borrar y volver a trazar).

## Arquitectura

```
app/src/
  types/domain.ts     # modelo de datos: Part, Pose, Plan, PlanStep, PartStepState, Arrow
  assembly/store.ts    # estado global (zustand): piezas, poses, planos/pasos, selección, flechas
  occ/
    init.ts             # carga/cachea la instancia WASM de OpenCASCADE una sola vez
    stepImport.ts         # lee STEP/IGES, separa el compound en piezas "rígidas"
    tessellate.ts          # B-Rep -> Float32Array de posiciones/normales/índices (Part)
  importers/loadModel.ts  # STL/OBJ/glTF -> Part[] (separa cuerpos, recentra origen) + despacha a occ/ para STEP/IGES
  scene/
    Viewport.tsx        # escena three.js: cámara orto, OrbitControls, picking, drag, modos de render, flechas
    viewPresets.ts       # direcciones de cámara para cada vista (iso/front/top/...)
  components/
    Toolbar.tsx          # importar, elegir vista y modo de render
    PartsPanel.tsx        # árbol de piezas: visibilidad, color, color de contorno por paso
    PlansPanel.tsx         # crear planos, agregar/duplicar/eliminar pasos, herramienta de flechas
```

Separación clave (igual que el proyecto de referencia): `occ/` no sabe nada de three.js ni de React — solo produce arrays planos de geometría a partir del kernel OCCT. `scene/Viewport.tsx` es lo único que construye objetos three.js a partir de esos datos.

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
