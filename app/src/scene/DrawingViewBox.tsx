import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import * as THREE from "three";
import { useAssemblyStore } from "../assembly/store";
import { applyViewPreset, rightFor, upFor } from "./viewPresets";
import { computeViewPlaneBounds } from "./bounds";
import { PX_PER_MM } from "./paper";
import {
  applyRenderMode,
  createPartVisual,
  disposePartVisual,
  poseToMatrix,
  type PartVisual,
} from "./partVisual";
import type { ViewInstance } from "../types/domain";

const HEADER_HEIGHT = 24;
const MARGIN_PX = 24; // breathing room around the projected geometry

interface Props {
  sheetId: string;
  view: ViewInstance;
  isActive: boolean;
}

export default function DrawingViewBox({ sheetId, view, isActive }: Props) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const visualsRef = useRef<Map<string, PartVisual>>(new Map());

  const setActiveView = useAssemblyStore((s) => s.setActiveView);
  const moveView = useAssemblyStore((s) => s.moveView);
  const deleteView = useAssemblyStore((s) => s.deleteView);
  const addAnnotation = useAssemblyStore((s) => s.addAnnotation);

  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[] | null>(null);

  const parts = useAssemblyStore((s) => s.parts);
  const penToolActive = useAssemblyStore((s) => s.penToolActive);
  const penStyle = useAssemblyStore((s) => s.penStyle);

  // real-world (mm) size of the frozen, visible geometry projected onto
  // this view's own camera plane
  const planeBounds = useMemo(() => {
    const right = rightFor(view.viewPreset);
    const up = upFor(view.viewPreset);
    return computeViewPlaneBounds(parts, view.partStates, right, up);
  }, [parts, view.partStates, view.viewPreset]);

  const contentWidth = planeBounds
    ? Math.max(planeBounds.widthMm * view.scale * PX_PER_MM, 10)
    : 200;
  const contentHeight = planeBounds
    ? Math.max(planeBounds.heightMm * view.scale * PX_PER_MM, 10)
    : 150;
  const boxWidth = contentWidth + MARGIN_PX * 2;
  const boxHeight = contentHeight + MARGIN_PX * 2 + HEADER_HEIGHT;

  // --- one-time renderer/scene setup ---
  useEffect(() => {
    const container = canvasContainerRef.current!;
    const scene = new THREE.Scene();
    scene.background = null; // transparent: overlapping views don't hide each other
    sceneRef.current = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.55);
    dir1.position.set(5, -5, 8);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, 5, -3);
    scene.add(dir2);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 100000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    let running = true;
    function loop() {
      if (!running) return;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();

    return () => {
      running = false;
      visualsRef.current.forEach((v) => disposePartVisual(v));
      visualsRef.current.clear();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- resize renderer/camera to computed box size ---
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    renderer.setSize(contentWidth, contentHeight);
    if (planeBounds) {
      const aspect = contentWidth / contentHeight;
      const marginMm = MARGIN_PX / (view.scale * PX_PER_MM);
      const halfW = planeBounds.widthMm / 2 + marginMm;
      const halfH = planeBounds.heightMm / 2 + marginMm;
      const frustumH = Math.max(halfH * 2, (halfW * 2) / aspect);
      camera.left = (-frustumH * aspect) / 2;
      camera.right = (frustumH * aspect) / 2;
      camera.top = frustumH / 2;
      camera.bottom = -frustumH / 2;
      camera.near = 0.001;
      camera.far = Math.max(frustumH * 200, 1000);
      applyViewPreset(camera, view.viewPreset, planeBounds.center, frustumH * 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentWidth, contentHeight, planeBounds, view.viewPreset, view.scale]);

  // --- rebuild geometry whenever this view's frozen part states change ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const visuals = visualsRef.current;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, view.partStates, view.renderMode]);

  // --- drag header to move ---
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

  // --- pen tool: click to add points, double-click/Enter to finish, Escape to cancel ---
  function onOverlayClick(e: ReactMouseEvent<SVGSVGElement>) {
    setActiveView(view.id);
    if (!penToolActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDraftPoints((prev) => [...(prev ?? []), { x, y }]);
  }

  function finishStroke() {
    if (draftPoints && draftPoints.length >= 2) {
      addAnnotation(sheetId, view.id, draftPoints);
    }
    setDraftPoints(null);
    useAssemblyStore.getState().setPenToolActive(false);
  }

  function onOverlayDoubleClick(e: ReactMouseEvent) {
    e.preventDefault();
    finishStroke();
  }

  useEffect(() => {
    if (!draftPoints) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") finishStroke();
      if (e.key === "Escape") {
        setDraftPoints(null);
        useAssemblyStore.getState().setPenToolActive(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPoints]);

  function pointsToPath(points: { x: number; y: number }[], w: number, h: number) {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)}`)
      .join(" ");
  }

  const svgW = boxWidth;
  const svgH = boxHeight - HEADER_HEIGHT;

  return (
    <div
      className="absolute select-none"
      style={{ left: view.x, top: view.y, width: boxWidth, height: boxHeight }}
      onPointerDown={() => setActiveView(view.id)}
    >
      <div
        className={`flex items-center justify-between px-2 text-xs cursor-move rounded-t ${
          isActive ? "bg-blue-600 text-white" : "bg-neutral-800/80 text-neutral-200"
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
        className={`relative ${isActive ? "outline outline-2 outline-blue-500" : ""}`}
        style={{ width: boxWidth, height: boxHeight - HEADER_HEIGHT }}
      >
        <div
          ref={canvasContainerRef}
          className="absolute"
          style={{ left: MARGIN_PX, top: MARGIN_PX, width: contentWidth, height: contentHeight }}
        />
        <svg
          className="absolute inset-0"
          width={svgW}
          height={svgH}
          style={{ cursor: penToolActive ? "crosshair" : "default" }}
          onClick={onOverlayClick}
          onDoubleClick={onOverlayDoubleClick}
        >
          {view.annotations.map((a) => (
            <path
              key={a.id}
              d={pointsToPath(a.points, svgW, svgH)}
              fill="none"
              stroke={a.color}
              strokeWidth={a.strokeWidth}
              strokeDasharray={a.dashed ? `${a.strokeWidth * 3} ${a.strokeWidth * 2}` : undefined}
              strokeLinecap={a.rounded ? "round" : "butt"}
              strokeLinejoin={a.rounded ? "round" : "miter"}
            />
          ))}
          {draftPoints && draftPoints.length > 0 && (
            <path
              d={pointsToPath(draftPoints, svgW, svgH)}
              fill="none"
              stroke={penStyle.color}
              strokeWidth={penStyle.strokeWidth}
              strokeDasharray={penStyle.dashed ? "6 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
