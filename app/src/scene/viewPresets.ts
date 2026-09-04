import * as THREE from "three";
import type { ViewPreset } from "../types/domain";

// Z-up convention (standard mechanical CAD). Directions are camera position
// direction from the target, normalized; `up` is always world Z.
export const VIEW_DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  iso: new THREE.Vector3(1, -1, 1).normalize(),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
};

export const WORLD_UP = new THREE.Vector3(0, 0, 1);

export function applyViewPreset(
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  preset: ViewPreset,
  target: THREE.Vector3,
  distance: number
) {
  const dir = VIEW_DIRECTIONS[preset];
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.up.copy(preset === "top" || preset === "bottom" ? new THREE.Vector3(0, 1, 0) : WORLD_UP);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
