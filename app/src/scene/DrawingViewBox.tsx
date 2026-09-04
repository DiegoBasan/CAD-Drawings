import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { useAssemblyStore } from "../assembly/store";
import { applyViewPreset } from "./viewPresets";
import { computeViewBounds } from "./bounds";
import {
  applyRenderMode,
  createPartVisual,
  disposePartVisual,
  poseToMatrix,
  type PartVisual,
} from "./partVisual";
import type { ViewInstance } from "../types/domain";

const HEADER_HEIGHT = 28;

interface Props {
  sheetId: string;
  view: ViewInstance;
  isActive: boolean;
}

export default function DrawingViewBox({ sheetId, view, isActive }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const visualsRef = useRef<Map<string, PartVisual>>(new Map());
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const pendingArrowStartRef = useRef<THREE.Vector3 | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  const setActiveView = useAssemblyStore((s) => s.setActiveView);
  const moveView = useAssemblyStore((s) => s.moveView);
  const resizeView = useAssemblyStore((s) => s.resizeView);
  const deleteView = useAssemblyStore((s) => s.deleteView);
  const addArrowToView = useAssemblyStore((s) => s.addArrowToView);

  // --- one-time renderer/scene setup ---
  useEffect(() => {
    const container = canvasContainerRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dir1.position.set(5, -5, 8);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, 5, -3);
    scene.add(dir2);

    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 100000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    let running = true;
    function loop() {
      if (!running) return;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();

    function onPointerDown(e: PointerEvent) {
      setActiveView(view.id);
      const { arrowToolActive } = useAssemblyStore.getState();
      if (!arrowToolActive) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(ndc, camera);
      const meshes: THREE.Mesh[] = [];
      visualsRef.current.forEach((v) => {
        if (v.mesh.visible) meshes.push(v.mesh);
      });
      const hits = raycaster.intersectObjects(meshes, false);
      let point: THREE.Vector3 | null = null;
      if (hits.length > 0) {
        point = hits[0].point.clone();
      } else {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, p)) point = p;
      }
      if (!point) return;

      const start = pendingArrowStartRef.current;
      if (!start) {
        pendingArrowStartRef.current = point;
      } else {
        addArrowToView(
          sheetId,
          view.id,
          [start.x, start.y, start.z],
          [point.x, point.y, point.z]
        );
        pendingArrowStartRef.current = null;
        useAssemblyStore.getState().setArrowToolActive(false);
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    return () => {
      running = false;
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      visualsRef.current.forEach((v) => disposePartVisual(v));
      visualsRef.current.clear();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- resize renderer/camera to box size ---
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    const w = Math.max(1, view.width);
    const h = Math.max(1, view.height - HEADER_HEIGHT);
    renderer.setSize(w, h);
  }, [view.width, view.height]);

  // --- rebuild geometry + camera fit + arrows whenever this view's data changes ---
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    const { parts } = useAssemblyStore.getState();
    const visuals = visualsRef.current;

    // remove parts no longer relevant
    for (const [id, visual] of visuals) {
      if (!view.partStates[id]?.visible) {
        scene.remove(visual.mesh, visual.edges);
        disposePartVisual(visual);
        visuals.delete(id);
      }
    }

    for (const [id, state] of Object.entries(view.partStates)) {
      const part = parts[id];
      if (!part || !state.visible || !state.pose) continue;
      let visual = visuals.get(id);
      if (!visual) {
        visual = createPartVisual(part);
        scene.add(visual.mesh, visual.edges);
        visuals.set(id, visual);
      }
      visual.mesh.matrixAutoUpdate = false;
      visual.edges.matrixAutoUpdate = false;
      const m = poseToMatrix(state.pose);
      visual.mesh.matrix.copy(m);
      visual.edges.matrix.copy(m);
      visual.mesh.visible = true;
      visual.edges.visible = true;

      visual.material.color.set(state.highlightColor ?? part.color);
      if (state.opacity !== undefined) {
        visual.material.transparent = true;
        visual.material.opacity = state.opacity;
      }
      visual.edgeMaterial.color.set(state.outlineColor ?? "#0a0a0a");
      visual.edgeMaterial.linewidth = state.outlineColor ? 2 : 1;

      applyRenderMode(
        view.renderMode,
        visual.material,
        visual.edgeMaterial,
        visual.mesh,
        visual.edges
      );
    }

    const bounds = computeViewBounds(parts, view.partStates);
    const w = Math.max(1, view.width);
    const h = Math.max(1, view.height - HEADER_HEIGHT);
    const aspect = w / h;
    if (bounds) {
      const frustum = Math.max(bounds.radius * 2.4, 1e-3);
      camera.left = (-frustum * aspect) / 2;
      camera.right = (frustum * aspect) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.near = 0.001;
      camera.far = Math.max(frustum * 200, 1000);
      applyViewPreset(camera, view.viewPreset, bounds.center, frustum * 2);
    } else {
      camera.left = -1;
      camera.right = 1;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    }

    // arrows
    const arrowGroup = arrowGroupRef.current;
    if (arrowGroup) {
      while (arrowGroup.children.length) {
        const child = arrowGroup.children.pop()!;
        if (child instanceof THREE.ArrowHelper) child.dispose();
      }
      const scale = bounds ? Math.max(bounds.radius * 0.15, 1e-4) : 0.1;
      for (const arrow of view.arrows) {
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
          Math.min(scale, length * 0.3),
          Math.min(scale * 0.6, length * 0.2)
        );
        arrowGroup.add(helper);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // --- drag to move ---
  function onHeaderPointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    setActiveView(view.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = view.x;
    const originY = view.y;

    function onMove(ev: PointerEvent) {
      moveView(
        sheetId,
        view.id,
        originX + (ev.clientX - startX),
        originY + (ev.clientY - startY)
      );
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onResizeHandlePointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originW = view.width;
    const originH = view.height;

    function onMove(ev: PointerEvent) {
      resizeView(
        sheetId,
        view.id,
        originW + (ev.clientX - startX),
        originH + (ev.clientY - startY)
      );
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={rootRef}
      className={`absolute bg-white shadow select-none ${
        isActive ? "ring-2 ring-blue-500" : "ring-1 ring-neutral-300"
      }`}
      style={{ left: view.x, top: view.y, width: view.width, height: view.height }}
      onPointerDown={() => setActiveView(view.id)}
    >
      <div
        className={`flex items-center justify-between px-2 text-xs cursor-move ${
          isActive ? "bg-blue-600 text-white" : "bg-neutral-200 text-neutral-700"
        }`}
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={onHeaderPointerDown}
      >
        <span className="truncate">{view.label}</span>
        <button
          className="px-1 hover:opacity-70"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deleteView(sheetId, view.id)}
        >
          x
        </button>
      </div>
      <div
        ref={canvasContainerRef}
        style={{ width: view.width, height: view.height - HEADER_HEIGHT }}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-neutral-400"
        onPointerDown={onResizeHandlePointerDown}
      />
    </div>
  );
}
