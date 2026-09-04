# CAD-Drawings

Visor CAD web para crear guías de ensamble paso a paso (estilo manual de LEGO / dibujo isométrico de SolidWorks), a partir de modelos importados.

## Qué hace hoy

- **Importar CAD real**: `.step`/`.stp` e `.iges`/`.igs` vía `opencascade.js` (OCCT compilado a WASM) — geometría B-Rep de verdad, no solo mallas. También `.stl`, `.obj`, `.glb`/`.gltf`. Cada cuerpo/mesh se separa en una **pieza** independiente y movible; en un STEP de ensamble, cada sub-compound no anidado se trata como una pieza rígida (ver `occ/stepImport.ts`).
- **Dos pestañas independientes, siempre montadas** (cambiar de pestaña solo las oculta con CSS, no destruye el contexto WebGL — antes volver de "Dibujo 2D" a "Ensamble 3D" dejaba la vista en blanco y sin poder navegar): "Ensamble 3D" (edición libre: orbitar, mover piezas, elegir vista/modo de render) y "Dibujo 2D" (canvas con hojas de tamaño de papel real, donde se componen vistas ya congeladas).
- **Mover piezas** individualmente arrastrando con el mouse — solo en la pestaña 3D.
- **Separar piezas multi-cuerpo**: si un STEP se importó como una sola pieza pero en realidad son varios cuerpos sueltos (el heurístico de separación de compounds no siempre acierta), el botón "separar" en el panel de piezas la descompone por conectividad de malla (mismo criterio del proyecto de referencia: soldar vértices por epsilon y agrupar triángulos conectados) sin mover nada visualmente.
- **10 vistas de cámara** con iconos en vez de texto: frontal, posterior, lateral izquierda, lateral derecha, superior, inferior, y 4 isométricas (una por cada combinación de esquina superior/inferior).
- **Modos de visualización**: color (shaded), rayos X, armazón (solo líneas, con oclusión — el sólido actúa de ocluyente invisible para que las aristas del lado lejano no se vean a través de la pieza), armazón rayos X (igual pero sin oclusión, totalmente transparente).
- **Cámara auto-encuadrada**: al importar, la cámara y la cuadrícula (pestaña 3D) se ajustan automáticamente al tamaño real del modelo.
- **Dibujos tipo SolidWorks**: en la pestaña 3D acomodas las piezas libremente. En la pestaña 2D creas uno o más **canvas** (hojas con tamaño de papel real A4/A3/A2/A1), y en cada uno **insertas vistas** con los botones de icono — cada vista congela el acomodo actual del ensamble 3D en ese instante como una proyección ortográfica. El tamaño de cada vista en la hoja **no es arbitrario**: se calcula a partir del tamaño real (mm) de la geometría proyectada y la **escala** elegida (2:1, 1:1, 1:2 ... 1:100), igual que insertar una vista en un drawing real. El fondo de cada vista es **transparente**, así que varias vistas pueden solaparse sin taparse entre sí; se reposicionan arrastrando su barra superior. **Zoom con la rueda del mouse y paneo con clic derecho**, igual que en el editor 3D.
- **Señalar piezas**: seleccionando una vista, el panel lateral lista sus piezas y permite asignar un color de contorno distinto por pieza para resaltarla.
- **Anotaciones tipo Figma (pluma)**: con una vista seleccionada, activa la pluma y haz clic para ir agregando puntos (se van uniendo en una polilínea en vivo); doble clic o Enter termina el trazo, Esc lo cancela. Cada trazo tiene color, grosor, línea continua/discontinua y esquinas/puntas redondeadas u ortogonales, configurables antes de dibujar. El trazo se dibuja en un overlay SVG encima del render 3D de la vista (no lo oculta el sólido).

## Qué falta / roadmap

- Las aristas de piezas STEP se dibujan hoy desde la malla triangulada (`THREE.EdgesGeometry`), no desde las curvas B-Rep reales — los círculos/filetes se ven poligonales en vez de perfectamente suaves. El siguiente paso natural es samplear `BRepAdaptor_Curve` por arista y dibujar esas polilíneas en vez de depender del umbral de ángulo de la malla.
- Guardar/cargar proyecto (`.json` con piezas + poses + canvas + vistas + anotaciones).
- Snap a un solo eje al arrastrar (Shift), rotación de piezas (arcball / spin) en la pestaña 3D.
- Editar un trazo ya creado (mover un punto individual, cambiar su estilo después de dibujado) — hoy solo se puede borrar y volver a trazar.
- Orientación horizontal de hoja (hoy solo vertical/portrait).

## Arquitectura

```
app/src/
  types/domain.ts     # modelo de datos: Part, Pose, Sheet, ViewInstance, PartStepState, Annotation
  assembly/store.ts    # estado global (zustand): piezas/poses (3D), tab activa, hojas/vistas/anotaciones (2D)
  occ/
    init.ts             # carga/cachea la instancia WASM de OpenCASCADE una sola vez
    stepImport.ts         # lee STEP/IGES, separa el compound en piezas "rígidas"
    tessellate.ts          # B-Rep -> Float32Array de posiciones/normales/índices (Part)
  importers/
    loadModel.ts          # STL/OBJ/glTF -> Part[] (separa cuerpos, recentra origen) + despacha a occ/ para STEP/IGES
    splitMesh.ts            # separa una Part en sus componentes conectados (botón "separar")
  scene/
    partVisual.ts        # helpers compartidos: construir/actualizar mesh+edges de una Part, aplicar modo de render
    bounds.ts             # bounding sphere/rectángulo proyectado del ensamble (o de una vista congelada)
    paper.ts               # tamaños de hoja ISO 216 en px, opciones de escala
    viewPresets.ts           # direcciones/up/right de cámara para las 10 vistas
    Viewport.tsx              # pestaña 3D: escena libre, OrbitControls, picking, drag de piezas
    DrawingViewBox.tsx         # una vista insertada en el canvas 2D: mini-render congelado de tamaño fijo por escala + overlay SVG de anotaciones
  components/
    Toolbar.tsx          # importar, cambiar de pestaña, (en 3D) elegir vista/modo de render
    PartsPanel.tsx        # pestaña 3D: lista de piezas, visibilidad, color, separar
    DrawingCanvas.tsx      # pestaña 2D: hojas (tamaño de papel), botones "+ vista", zoom/pan del canvas
    ViewInspector.tsx       # panel lateral en 2D: direccion/escala/modo de la vista activa, pluma, contorno por pieza
    ViewPresetIcon.tsx       # iconos SVG de las 10 direcciones de vista
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
