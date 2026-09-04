# CAD-Drawings

Visor CAD web para crear guías de ensamble paso a paso (estilo manual de LEGO / dibujo isométrico de SolidWorks), a partir de modelos importados.

## Qué hace hoy

- **Importar** modelos (`.stl`, `.obj`, `.glb`/`.gltf`) — cada cuerpo/mesh se separa en una **pieza** independiente y movible.
- **Mover piezas** individualmente arrastrando con el mouse (drag sobre un plano perpendicular a la cámara).
- **Vistas de cámara**: isométrica, frontal, posterior, izquierda, derecha, superior, inferior (convención Z-up, cámara ortográfica).
- **Modos de visualización**: color (shaded), rayos X, armazón (solo líneas / wireframe), armazón rayos X.
- **Planos (guías paso a paso)**: crea un "plano", agrega pasos que capturan el estado actual del ensamble (posición de cada pieza, visibilidad, vista de cámara, modo de render). Navega entre pasos para reproducir la guía.
- **Señalar piezas**: en cada paso, cualquier pieza puede recibir un color de contorno (`outlineColor`) distinto para resaltarla, independiente del color base de la pieza.

## Qué falta / roadmap

- **Importación STEP/IGES real** vía `opencascade.js` (OCCT compilado a WASM) — hoy solo se soportan mallas ya trianguladas (STL/OBJ/glTF). Ver la sección de arquitectura abajo: el módulo `occ/` está pensado para añadirse sin tocar el resto del código (aislado de three.js/React, solo produce `Float32Array`s de posiciones/normales/índices, igual que `importers/loadModel.ts` hoy).
- **Flechas y anotaciones** en el plano (`Arrow` ya existe en el modelo de datos `types/domain.ts`, falta la UI para dibujarlas en el Viewport).
- Guardar/cargar proyecto (`.json` con piezas + poses + planos).
- Snap a un solo eje al arrastrar (Shift), rotación de piezas (arcball / spin), como en el proyecto de referencia.

## Arquitectura

```
app/src/
  types/domain.ts     # modelo de datos: Part, Pose, Plan, PlanStep, PartStepState, Arrow
  assembly/store.ts    # estado global (zustand): piezas, poses, planos/pasos, selección
  importers/loadModel.ts  # STL/OBJ/glTF -> Part[] (separa cuerpos, recentra origen)
  scene/
    Viewport.tsx        # escena three.js: cámara orto, OrbitControls, picking, drag, modos de render
    viewPresets.ts       # direcciones de cámara para cada vista (iso/front/top/...)
  components/
    Toolbar.tsx          # importar, elegir vista y modo de render
    PartsPanel.tsx        # árbol de piezas: visibilidad, color, color de contorno por paso
    PlansPanel.tsx         # crear planos, agregar/duplicar/eliminar pasos, navegar
```

Separación clave (igual que el proyecto de referencia): la parte que entiende CAD (`importers/`, y en el futuro `occ/`) no sabe nada de three.js — solo produce arrays planos de geometría. `scene/Viewport.tsx` es lo único que construye objetos three.js a partir de esos datos.

## Desarrollo

```bash
cd app
npm install
npm run dev
```
