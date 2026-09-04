import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useAssemblyStore } from "../assembly/store";
import { applyViewPreset } from "./viewPresets";
import { computeAssemblyBounds } from "./bounds";
import {
  applyRenderMode,
  createPartVisual,
  disposePartVisual,
  poseToMatrix,
  type PartVisual,
} from "./partVisual";
import type { Part } from "../types/domain";

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
  const frustumSizeRef = useRef(5);

  // --- one-time scene setup ---
  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1f24);
    sceneRef.current = scene;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (-frustumSizeRef.current * aspect) / 2,
      (frustumSizeRef.current * aspect) / 2,
      frustumSizeRef.current / 2,
      -frustumSizeRef.current / 2,
      0.001,
      100000
    );
    applyViewPreset(camera, "isoTopA", new THREE.Vector3(0, 0, 0), 10);
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
      if (w === 0 || h === 0) return; // hidden (other tab active)
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
    // Toggling the container's visibility (switching tabs) doesn't fire a
    // window resize event, so watch the container itself -- otherwise
    // coming back to this tab leaves the renderer sized 0x0 from when it
    // was hidden.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

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

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const ndc = toNDC(e);
      const id = pickPartId(ndc);
      const { selectPart } = useAssemblyStore.getState();
      selectPart(id);
      if (!id) return;

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
      resizeObserver.disconnect();
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
          disposePartVisual(visual);
          visuals.delete(id);
        }
      }

      for (const part of Object.values(parts)) {
        if (visuals.has(part.id)) continue;
        hasNewPart = true;
        const visual = createPartVisual(part);
        scene.add(visual.mesh, visual.edges);
        visuals.set(part.id, visual);
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

  // --- sync poses, colors, visibility, view preset, render mode, selection ---
  useEffect(() => {
    const unsub = useAssemblyStore.subscribe((state) => applyState(state));
    applyState(useAssemblyStore.getState());
    return unsub;

    function applyState(state: ReturnType<typeof useAssemblyStore.getState>) {
      const visuals = visualsRef.current;

      for (const [id, visual] of visuals) {
        const part = state.parts[id];
        if (!part) continue;
        const pose = state.poses[id];

        visual.mesh.matrixAutoUpdate = false;
        visual.edges.matrixAutoUpdate = false;
        const m = poseToMatrix(pose);
        visual.mesh.matrix.copy(m);
        visual.edges.matrix.copy(m);

        visual.mesh.visible = part.visible;
        visual.edges.visible = part.visible;

        visual.material.color.set(part.color);

        const isSelected = state.selectedPartId === id;
        visual.edgeMaterial.color.set(isSelected ? "#ff9900" : "#0a0a0a");
        visual.edgeMaterial.linewidth = isSelected ? 2 : 1;

        if (part.visible) {
          applyRenderMode(
            state.renderMode,
            visual.material,
            visual.edgeMaterial,
            visual.mesh,
            visual.edges
          );
        }
      }

      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const renderer = rendererRef.current;
      if (camera && controls && renderer) {
        if ((camera as any)._lastPreset !== state.viewPreset) {
          (camera as any)._lastPreset = state.viewPreset;
          applyViewPreset(
            camera,
            state.viewPreset,
            controls.target,
            frustumSizeRef.current * 2
          );
          controls.dispose();
          const newControls = new OrbitControls(camera, renderer.domElement);
          newControls.target.copy(controls.target);
          newControls.update();
          controlsRef.current = newControls;
        }
      }
    }
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
