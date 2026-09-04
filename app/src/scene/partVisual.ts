import * as THREE from "three";
import type { Part, Pose, RenderMode } from "../types/domain";

export interface PartVisual {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  material: THREE.MeshStandardMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
}

export function poseToMatrix(pose: Pose): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion(...pose.quaternion),
    new THREE.Vector3(...pose.scale)
  );
  return m;
}

export function createPartVisual(part: Part): PartVisual {
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

  return { mesh, edges, material, edgeMaterial };
}

export function disposePartVisual(visual: PartVisual) {
  visual.mesh.geometry.dispose();
  visual.material.dispose();
  visual.edges.geometry.dispose();
  visual.edgeMaterial.dispose();
}

/**
 * shaded: normal solid render.
 * xray: solid rendered translucent, edges fully visible (see-through).
 * wireframe: only edges visible, but the solid still occludes far edges
 *   (hidden-line-removed look) -- the mesh is rendered depth-only
 *   (colorWrite off) so it doesn't paint over the lines but still hides
 *   the ones behind it.
 * wireframe-xray: only edges visible, nothing occludes anything -- a true
 *   see-through wireframe.
 */
export function applyRenderMode(
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
      material.colorWrite = true;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      edgeMaterial.depthTest = true;
      break;
    case "xray":
      mesh.visible = true;
      edges.visible = true;
      material.transparent = true;
      material.opacity = 0.25;
      material.depthWrite = false;
      material.colorWrite = true;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      edgeMaterial.depthTest = true;
      break;
    case "wireframe":
      // Keep the solid in the scene as a depth-only occluder so far-side
      // edges get properly hidden instead of showing through like x-ray.
      mesh.visible = true;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.colorWrite = false;
      edges.visible = true;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
      edgeMaterial.depthTest = true;
      break;
    case "wireframe-xray":
      mesh.visible = false;
      edges.visible = true;
      edgeMaterial.transparent = true;
      edgeMaterial.opacity = 0.35;
      edgeMaterial.depthTest = false;
      break;
  }
}
