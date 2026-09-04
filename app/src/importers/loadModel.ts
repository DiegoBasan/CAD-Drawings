import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { Part, PartGeometry } from "../types/domain";
import { nextId } from "../assembly/store";
import { importStepFile } from "../occ/stepImport";
import { tessellateBodies } from "../occ/tessellate";

function toPartGeometry(geom: THREE.BufferGeometry): PartGeometry {
  const g = geom.index ? geom : mergeVerticesFallback(geom);
  const posAttr = g.getAttribute("position") as THREE.BufferAttribute;
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const normAttr = g.getAttribute("normal") as THREE.BufferAttribute;
  const indices = g.index
    ? (g.index.array as Uint32Array | Uint16Array)
    : new Uint32Array(Array.from({ length: posAttr.count }, (_, i) => i));
  return {
    positions: new Float32Array(posAttr.array),
    normals: new Float32Array(normAttr.array),
    indices,
  };
}

// Non-indexed geometries (common in STL) are left as-is; picking/edges still work.
function mergeVerticesFallback(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  return geom;
}

function centerGeometry(geom: THREE.BufferGeometry): THREE.Vector3 {
  geom.computeBoundingBox();
  const center = new THREE.Vector3();
  geom.boundingBox!.getCenter(center);
  geom.translate(-center.x, -center.y, -center.z);
  return center;
}

function meshToPart(mesh: THREE.Mesh, name: string): Part {
  const geom = mesh.geometry.clone();
  geom.applyMatrix4(mesh.matrixWorld);
  const center = centerGeometry(geom);
  const color =
    (mesh.material as THREE.MeshStandardMaterial)?.color?.getStyle?.() ??
    "#b0b8c1";
  return {
    id: nextId("part"),
    name,
    geometry: toPartGeometry(geom),
    basePose: {
      position: [center.x, center.y, center.z],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    color,
    visible: true,
  };
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });
  return meshes;
}

export async function loadModelFile(file: File): Promise<Part[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "step" || ext === "stp" || ext === "iges" || ext === "igs") {
    const { bodies, oc } = await importStepFile(file);
    return tessellateBodies(oc, bodies);
  }

  const buffer = await file.arrayBuffer();

  if (ext === "stl") {
    const loader = new STLLoader();
    const geom = loader.parse(buffer);
    const mesh = new THREE.Mesh(geom);
    mesh.name = file.name.replace(/\.stl$/i, "");
    return [meshToPart(mesh, mesh.name)];
  }

  if (ext === "obj") {
    const text = new TextDecoder().decode(buffer);
    const loader = new OBJLoader();
    const group = loader.parse(text);
    const meshes = collectMeshes(group);
    return meshes.map((m, i) =>
      meshToPart(m, m.name || `${file.name}_${i}`)
    );
  }

  if (ext === "glb" || ext === "gltf") {
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(buffer, "", resolve, reject);
    });
    const meshes = collectMeshes(gltf.scene);
    return meshes.map((m, i) =>
      meshToPart(m, m.name || `${file.name}_${i}`)
    );
  }

  throw new Error(
    `Formato .${ext} no soportado. Usa STEP/STP, IGES/IGS, STL, OBJ o glTF/GLB.`
  );
}
