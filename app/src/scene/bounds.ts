import * as THREE from "three";
import type { Part, PartStepState, Pose } from "../types/domain";

/**
 * World-space bounding sphere of every part at its given pose. Used to
 * auto-frame the camera/grid to whatever was just imported instead of a
 * fixed guess -- a 50mm STEP part and a 2m weldment need very different
 * default zoom levels.
 */
export function computeAssemblyBounds(
  parts: Record<string, Part>,
  poses: Record<string, Pose>
): { center: THREE.Vector3; radius: number } | null {
  const box = new THREE.Box3();
  let any = false;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();

  for (const part of Object.values(parts)) {
    const pose = poses[part.id];
    if (!pose) continue;
    m.compose(
      new THREE.Vector3(...pose.position),
      new THREE.Quaternion(...pose.quaternion),
      new THREE.Vector3(...pose.scale)
    );
    const positions = part.geometry.positions;
    for (let i = 0; i < positions.length; i += 3) {
      v.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(m);
      box.expandByPoint(v);
      any = true;
    }
  }

  if (!any) return null;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(size.length() / 2, 1e-3);
  return { center, radius };
}

/** Same as computeAssemblyBounds but scoped to one drawing view's frozen,
 * per-part visibility/pose snapshot (only visible parts count). */
export function computeViewBounds(
  parts: Record<string, Part>,
  partStates: Record<string, PartStepState>
): { center: THREE.Vector3; radius: number } | null {
  const poses: Record<string, Pose> = {};
  const visibleParts: Record<string, Part> = {};
  for (const [id, state] of Object.entries(partStates)) {
    const part = parts[id];
    if (!part || !state.visible || !state.pose) continue;
    visibleParts[id] = part;
    poses[id] = state.pose;
  }
  return computeAssemblyBounds(visibleParts, poses);
}

/**
 * Tight 2D bounding rectangle of a view's frozen, visible geometry as
 * projected onto its own camera plane (right/up axes) -- used to size a
 * drawing view by real-world dimensions x scale, like a SolidWorks
 * inserted view, instead of an arbitrary freely-resized box.
 */
export function computeViewPlaneBounds(
  parts: Record<string, Part>,
  partStates: Record<string, PartStepState>,
  right: THREE.Vector3,
  up: THREE.Vector3
): { center: THREE.Vector3; widthMm: number; heightMm: number } | null {
  let any = false;
  let minR = Infinity;
  let maxR = -Infinity;
  let minU = Infinity;
  let maxU = -Infinity;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const box = new THREE.Box3();

  for (const [id, state] of Object.entries(partStates)) {
    const part = parts[id];
    if (!part || !state.visible || !state.pose) continue;
    m.compose(
      new THREE.Vector3(...state.pose.position),
      new THREE.Quaternion(...state.pose.quaternion),
      new THREE.Vector3(...state.pose.scale)
    );
    const positions = part.geometry.positions;
    for (let i = 0; i < positions.length; i += 3) {
      v.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(m);
      box.expandByPoint(v);
      const r = v.dot(right);
      const u = v.dot(up);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      any = true;
    }
  }

  if (!any) return null;
  const center = new THREE.Vector3();
  box.getCenter(center);
  return {
    center,
    widthMm: Math.max(maxR - minR, 1e-3),
    heightMm: Math.max(maxU - minU, 1e-3),
  };
}
