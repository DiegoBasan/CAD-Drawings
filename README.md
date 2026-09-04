# CAD-Drawings

Visor CAD web para crear guías de ensamble paso a paso (estilo manual de LEGO / dibujo isométrico de SolidWorks), a partir de modelos importados.

## Qué hace hoy

- **Importar CAD real**: `.step`/`.stp` e `.iges`/`.igs` vía `opencascade.js` (OCCT compilado a WASM) — geometría B-Rep de verdad, no solo mallas. También `.stl`, `.obj`, `.glb`/`.gltf`. Cada cuerpo/mesh se separa en una **pieza** independiente y movible; en un STEP de ensamble, cada sub-compound no anidado se trata como una pieza rígida (ver `occ/stepImport.ts`).
- **Mover piezas** individualmente arrastrando con el mouse (drag sobre un plano perpendicular a la cámara).
- **Vistas de cámara**: isométrica, frontal, posterior, izquierda, derecha, superior, inferior (convención Z-up, cámara ortográfica).
- **Modos de visualización**: color (shaded), rayos X, armazón (solo líneas / wireframe), armazón rayos X.
- **Planos (guías paso a paso)**: crea un "plano", agrega pasos que capturan el estado actual del ensamble (posición de cada pieza, visibilidad, vista de cámara, modo de render). Navega entre pasos para reproducir la guía.
- **Señalar piezas**: en cada paso, cualquier pieza puede recibir un color de contorno (`outlineColor`) distinto para resaltarla, independiente del color base de la pieza.
- **Flechas**: en cada paso puedes activar la herramienta de flecha y hacer clic en el punto de origen y luego en el destino (sobre cualquier pieza visible) para dibujar una flecha de instrucción; se listan y se pueden borrar desde el panel del plano.

## Qué falta / roadmap

- Las aristas de piezas STEP se dibujan hoy desde la malla triangulada (`THREE.EdgesGeometry`), no desde las curvas B-Rep reales — los círculos/filetes se ven poligonales en vez de perfectamente suaves. El siguiente paso natural es samplear `BRepAdaptor_Curve` por arista (igual que el proyecto de referencia) y dibujar esas polilíneas en vez de depender del umbral de ángulo de la malla.
- Guardar/cargar proyecto (`.json` con piezas + poses + planos).
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

El binario `opencascade.wasm.wasm` (~63 MB) vive en `app/public/` y se sirve como asset estático — `occ/init.ts` le pasa esa ruta absoluta a `locateFile` para que el loader de Emscripten no intente empaquetarlo con Vite. La primera vez que importas un STEP/IGES en una sesión del navegador, ese archivo se descarga una vez y queda cacheado por el navegador.

## Desarrollo

```bash
cd app
npm install
npm run dev
```
