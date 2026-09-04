import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useAssemblyStore } from "../assembly/store";
import { applyViewPreset } from "./viewPresets";
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

export default function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const visualsRef = useRef<Map<string, PartVisual>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragRef = useRef<{
    id: string;
    plane: THREE.Plane;
    offset: THREE.Vector3;
  } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);

  // --- one-time scene setup ---
  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1f24);
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const frustum = 5;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.01,
      1000
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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    let running = true;
    function renderLoop() {
      if (!running) return;
      processDrag();
      controls.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const asp = w / h;
      camera.left = (-frustum * asp) / 2;
      camera.right = (frustum * asp) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
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

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const ndc = toNDC(e);
      const id = pickPartId(ndc);
      const { selectPart, isPlanMode } = useAssemblyStore.getState();
      selectPart(id);
      if (!id || isPlanMode) return; // no drag-editing while viewing a locked plan step

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
      controls.enabled = false;
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
      const { setPartPose, parts, poses } = useAssemblyStore.getState();
      const pose = poses[drag.id];
      if (!pose) return;
      setPartPose(drag.id, {
        ...pose,
        position: [newWorldPos.x, newWorldPos.y, newWorldPos.z],
      });
      void parts;
    }

    function onPointerUp() {
      dragRef.current = null;
      controls.enabled = true;
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

  // --- sync parts (add/remove meshes) ---
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

      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (camera && controls) {
        const preset = step ? step.viewPreset : state.viewPreset;
        if ((camera as any)._lastPreset !== preset) {
          (camera as any)._lastPreset = preset;
          const dist = camera.position.distanceTo(controls.target) || 10;
          applyViewPreset(camera, preset, controls.target, dist);
          controls.dispose();
          const newControls = new OrbitControls(
            camera,
            rendererRef.current!.domElement
          );
          newControls.target.copy(controls.target);
          newControls.update();
          controlsRef.current = newControls;
        }
      }
    }
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
