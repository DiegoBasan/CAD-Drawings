import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useAssemblyStore } from "../assembly/store";
import { applyViewPreset } from "./viewPresets";
import { computeAssemblyBounds } from "./bounds";
import type { Part, Pose, RenderMode } from "../types/domain";

interface PartVisual {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  material: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
}

function poseToMatrix(pose: Pose): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion(...pose.quaternion),
    new THREE.Vector3(...pose.scale)
  );
  return m;
}

function applyRenderMode(
  mode: RenderMode,
  material: THREE.MeshStandardMaterial,
  edgeMaterial: THREE.LineBasicMaterial,
  mesh: THREE.Mesh,
  edges: THREE.LineSegments
) {
  material.wireframe = false;
  switch (mode) {
    case "shaded":
      mesh.visible = true;
      edges.visible = true;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      break;
    case "xray":
      mesh.visible = true;
      edges.visible = true;
      material.transparent = true;
      material.opacity = 0.25;
      material.depthWrite = false;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      break;
    case "wireframe":
      mesh.visible = false;
      edges.visible = true;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      break;
    case "wireframe-xray":
      mesh.visible = false;
      edges.visible = true;
      edgeMaterial.transparent = true;
      edgeMaterial.opacity = 0.35;
      break;
  }
}

/** "Nice" grid step (1, 2, 5 x10^n) at or below `raw`. */
function niceGridStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const frac = raw / base;
  const step = frac >= 5 ? 5 : frac >= 2 ? 2 : 1;
  return step * base;
}

export default function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const visualsRef = useRef<Map<string, PartVisual>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragRef = useRef<{
    id: string;
    plane: THREE.Plane;
    offset: THREE.Vector3;
  } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const pendingArrowStartRef = useRef<THREE.Vector3 | null>(null);
  const frustumSizeRef = useRef(5);

  // --- one-time scene setup ---
  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1f24);
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (-frustumSizeRef.current * aspect) / 2,
      (frustumSizeRef.current * aspect) / 2,
      frustumSizeRef.current / 2,
      -frustumSizeRef.current / 2,
      0.001,
      100000
    );
    applyViewPreset(camera, "iso", new THREE.Vector3(0, 0, 0), 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, -5, 8);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir2.position.set(-5, 5, -3);
    scene.add(dir2);

    const grid = new THREE.GridHelper(20, 20, 0x3a4048, 0x2a2f36);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    gridRef.current = grid;

    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    let running = true;
    function renderLoop() {
      if (!running) return;
      processDrag();
      controlsRef.current?.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const asp = w / h;
      const f = frustumSizeRef.current;
      camera.left = (-f * asp) / 2;
      camera.right = (f * asp) / 2;
      camera.top = f / 2;
      camera.bottom = -f / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    function toNDC(e: PointerEvent): THREE.Vector2 {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    }

    function pickPartId(ndc: THREE.Vector2): string | null {
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(ndc, camera);
      const meshes: THREE.Mesh[] = [];
      const idByMesh = new Map<THREE.Mesh, string>();
      visualsRef.current.forEach((v, id) => {
        if (v.mesh.visible) {
          meshes.push(v.mesh);
          idByMesh.set(v.mesh, id);
        }
      });
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return null;
      return idByMesh.get(hits[0].object as THREE.Mesh) ?? null;
    }

    function pickPoint(ndc: THREE.Vector2): THREE.Vector3 | null {
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(ndc, camera);
      const meshes: THREE.Mesh[] = [];
      visualsRef.current.forEach((v) => {
        if (v.mesh.visible) meshes.push(v.mesh);
      });
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) return hits[0].point.clone();
      const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const p = new THREE.Vector3();
      return raycaster.ray.intersectPlane(fallbackPlane, p) ? p : null;
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const ndc = toNDC(e);

      const {
        arrowToolActive,
        isPlanMode,
        currentPlanId,
        currentStepIndex,
        plans,
        addArrow,
      } = useAssemblyStore.getState();

      if (arrowToolActive && isPlanMode && currentPlanId) {
        const point = pickPoint(ndc);
        if (!point) return;
        const start = pendingArrowStartRef.current;
        if (!start) {
          pendingArrowStartRef.current = point;
        } else {
          const step = plans[currentPlanId]?.steps[currentStepIndex];
          if (step) {
            addArrow(
              currentPlanId,
              step.id,
              [start.x, start.y, start.z],
              [point.x, point.y, point.z]
            );
          }
          pendingArrowStartRef.current = null;
          useAssemblyStore.getState().setArrowToolActive(false);
        }
        return;
      }

      const id = pickPartId(ndc);
      const { selectPart } = useAssemblyStore.getState();
      selectPart(id);
      if (!id || isPlanMode) return; // drawing views are a fixed, locked projection

      const visual = visualsRef.current.get(id);
      if (!visual) return;

      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const worldPos = new THREE.Vector3();
      visual.mesh.getWorldPosition(worldPos);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camDir,
        worldPos
      );
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(ndc, camera);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hitPoint);
      const offset = worldPos.clone().sub(hitPoint);
      dragRef.current = { id, plane, offset };
      if (controlsRef.current) controlsRef.current.enabled = false;
    }

    function onPointerMove(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    }

    function processDrag() {
      const drag = dragRef.current;
      const ptr = pointerRef.current;
      if (!drag || !ptr) return;
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(new THREE.Vector2(ptr.x, ptr.y), camera);
      const hitPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
      const newWorldPos = hitPoint.add(drag.offset);
      const { setPartPose, poses } = useAssemblyStore.getState();
      const pose = poses[drag.id];
      if (!pose) return;
      setPartPose(drag.id, {
        ...pose,
        position: [newWorldPos.x, newWorldPos.y, newWorldPos.z],
      });
    }

    function onPointerUp() {
      dragRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // --- sync parts (add/remove meshes) + auto-frame camera/grid to scale ---
  useEffect(() => {
    const unsub = useAssemblyStore.subscribe((state, prev) => {
      if (state.parts !== prev.parts) syncParts(state.parts);
    });
    syncParts(useAssemblyStore.getState().parts);
    return unsub;

    function syncParts(parts: Record<string, Part>) {
      const scene = sceneRef.current;
      if (!scene) return;
      const visuals = visualsRef.current;
      let hasNewPart = false;

      for (const [id, visual] of visuals) {
        if (!parts[id]) {
          scene.remove(visual.mesh, visual.edges);
          visual.mesh.geometry.dispose();
          visual.material.dispose();
          visual.edges.geometry.dispose();
          visual.edgeMaterial.dispose();
          visuals.delete(id);
        }
      }

      for (const part of Object.values(parts)) {
        if (visuals.has(part.id)) continue;
        hasNewPart = true;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          "position",
          new THREE.BufferAttribute(part.geometry.positions, 3)
        );
        geom.setAttribute(
          "normal",
          new THREE.BufferAttribute(part.geometry.normals, 3)
        );
        geom.setIndex(new THREE.BufferAttribute(part.geometry.indices, 1));

        const material = new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: 0.6,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, material);

        const edgeGeom = new THREE.EdgesGeometry(geom, 30);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
        const edges = new THREE.LineSegments(edgeGeom, edgeMaterial);

        scene.add(mesh, edges);
        visuals.set(part.id, { mesh, edges, material, edgeMaterial });
      }

      if (hasNewPart) {
        const { parts: allParts, poses, viewPreset } =
          useAssemblyStore.getState();
        const bounds = computeAssemblyBounds(allParts, poses);
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const grid = gridRef.current;
        const renderer = rendererRef.current;
        if (bounds && camera && controls && grid && renderer) {
          const frustum = Math.max(bounds.radius * 2.4, 1e-3);
          frustumSizeRef.current = frustum;
          const w = renderer.domElement.clientWidth || 1;
          const h = renderer.domElement.clientHeight || 1;
          const aspect = w / h;
          camera.left = (-frustum * aspect) / 2;
          camera.right = (frustum * aspect) / 2;
          camera.top = frustum / 2;
          camera.bottom = -frustum / 2;
          camera.near = 0.001;
          camera.far = Math.max(frustum * 200, 1000);

          controls.target.copy(bounds.center);
          applyViewPreset(camera, viewPreset, bounds.center, frustum * 2);

          const gridStep = niceGridStep(frustum / 10);
          const divisions = Math.max(
            4,
            Math.min(200, Math.round((frustum * 1.6) / gridStep))
          );
          const size = gridStep * divisions;
          const newGrid = new THREE.GridHelper(
            size,
            divisions,
            0x3a4048,
            0x2a2f36
          );
          newGrid.rotation.x = Math.PI / 2;
          newGrid.position.set(bounds.center.x, bounds.center.y, 0);
          grid.parent?.add(newGrid);
          grid.parent?.remove(grid);
          grid.geometry.dispose();
          (grid.material as THREE.Material).dispose();
          gridRef.current = newGrid;

          controls.update();
        }
      }
    }
  }, []);

  // --- sync poses, colors, visibility, view mode, selection, plan step ---
  useEffect(() => {
    const unsub = useAssemblyStore.subscribe((state) => applyState(state));
    applyState(useAssemblyStore.getState());
    return unsub;

    function applyState(state: ReturnType<typeof useAssemblyStore.getState>) {
      const visuals = visualsRef.current;
      const step =
        state.isPlanMode && state.currentPlanId
          ? state.plans[state.currentPlanId]?.steps[state.currentStepIndex]
          : null;

      for (const [id, visual] of visuals) {
        const part = state.parts[id];
        if (!part) continue;
        const stepState = step?.partStates[id];
        const pose = stepState?.pose ?? state.poses[id];
        const visible = step ? stepState?.visible ?? false : part.visible;

        visual.mesh.matrixAutoUpdate = false;
        visual.edges.matrixAutoUpdate = false;
        const m = poseToMatrix(pose);
        visual.mesh.matrix.copy(m);
        visual.edges.matrix.copy(m);

        visual.mesh.visible = visible;
        visual.edges.visible = visible;

        const baseColor = stepState?.highlightColor ?? part.color;
        visual.material.color.set(baseColor);
        if (stepState?.opacity !== undefined) {
          visual.material.transparent = true;
          visual.material.opacity = stepState.opacity;
        }

        const isSelected = state.selectedPartId === id;
        const outline = stepState?.outlineColor;
        visual.edgeMaterial.color.set(
          outline ?? (isSelected ? "#ff9900" : "#0a0a0a")
        );
        visual.edgeMaterial.linewidth = outline || isSelected ? 2 : 1;

        if (visible) {
          applyRenderMode(
            step ? step.renderMode : state.renderMode,
            visual.material,
            visual.edgeMaterial,
            visual.mesh,
            visual.edges
          );
        }
      }

      const arrowGroup = arrowGroupRef.current;
      if (arrowGroup) {
        while (arrowGroup.children.length) {
          const child = arrowGroup.children.pop()!;
          if (child instanceof THREE.ArrowHelper) child.dispose();
        }
        const arrowScale = Math.max(frustumSizeRef.current * 0.06, 1e-4);
        for (const arrow of step?.arrows ?? []) {
          const from = new THREE.Vector3(...arrow.from);
          const to = new THREE.Vector3(...arrow.to);
          const dir = to.clone().sub(from);
          const length = dir.length() || 0.001;
          dir.normalize();
          const helper = new THREE.ArrowHelper(
            dir,
            from,
            length,
            new THREE.Color(arrow.color).getHex(),
            Math.min(arrowScale, length * 0.3),
            Math.min(arrowScale * 0.6, length * 0.2)
          );
          arrowGroup.add(helper);
        }
      }

      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const renderer = rendererRef.current;
      if (camera && controls && renderer) {
        // A drawing step is a fixed, locked orthographic projection --
        // like an inserted view in a SolidWorks drawing -- so disable
        // free rotation while one is active. Panning/zooming to inspect
        // the view is still allowed.
        controls.enableRotate = !state.isPlanMode;

        const preset = step ? step.viewPreset : state.viewPreset;
        if ((camera as any)._lastPreset !== preset) {
          (camera as any)._lastPreset = preset;
          applyViewPreset(
            camera,
            preset,
            controls.target,
            frustumSizeRef.current * 2
          );
          controls.dispose();
          const newControls = new OrbitControls(camera, renderer.domElement);
          newControls.target.copy(controls.target);
          newControls.enableRotate = !state.isPlanMode;
          newControls.update();
          controlsRef.current = newControls;
        }
      }
    }
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
