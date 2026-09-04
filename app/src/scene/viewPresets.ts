import * as THREE from "three";
import type { ViewPreset } from "../types/domain";

// Z-up convention (standard mechanical CAD). Directions are camera position
// direction from the target, normalized; `up` is world Z except when looking
// straight down/up the Z axis, where world Z can't serve as `up`.
export const VIEW_DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
  isoTopA: new THREE.Vector3(1, -1, 1).normalize(),
  isoTopB: new THREE.Vector3(-1, 1, 1).normalize(),
  isoBottomA: new THREE.Vector3(1, -1, -1).normalize(),
  isoBottomB: new THREE.Vector3(-1, 1, -1).normalize(),
};

export const VIEW_PRESET_LABEL: Record<ViewPreset, string> = {
  front: "Frontal",
  back: "Posterior",
  left: "Lateral izquierda",
  right: "Lateral derecha",
  top: "Superior",
  bottom: "Inferior",
  isoTopA: "Isometrica",
  isoTopB: "Isometrica (esquina opuesta)",
  isoBottomA: "Isometrica inferior",
  isoBottomB: "Isometrica inferior (esquina opuesta)",
};

export const WORLD_UP = new THREE.Vector3(0, 0, 1);
const SCREEN_UP = new THREE.Vector3(0, 1, 0);

export function upFor(preset: ViewPreset): THREE.Vector3 {
  return preset === "top" || preset === "bottom" ? SCREEN_UP : WORLD_UP;
}

/** Camera-right axis for a preset's view direction (screen +X). */
export function rightFor(preset: ViewPreset): THREE.Vector3 {
  const dir = VIEW_DIRECTIONS[preset];
  const up = upFor(preset);
  // camera looks along +dir (from target+dir*dist towards target, i.e. -dir);
  // screen-right = up x lookDirection, lookDirection = -dir
  return new THREE.Vector3().crossVectors(up, dir).normalize();
}

export function applyViewPreset(
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  preset: ViewPreset,
  target: THREE.Vector3,
  distance: number
) {
  const dir = VIEW_DIRECTIONS[preset];
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.up.copy(upFor(preset));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
