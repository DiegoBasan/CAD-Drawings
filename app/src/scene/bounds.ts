import * as THREE from "three";
import type { Part, Pose } from "../types/domain";

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
