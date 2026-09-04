export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x,y,z,w

export interface Pose {
  position: Vec3;
  quaternion: Quat;
  scale: Vec3;
}

export function identityPose(): Pose {
  return { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
}

export interface PartGeometry {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array | Uint16Array;
}

export interface Part {
  id: string;
  name: string;
  geometry: PartGeometry;
  basePose: Pose; // pose at import time
  color: string;
  visible: boolean;
}

export type RenderMode = "shaded" | "xray" | "wireframe" | "wireframe-xray";

export type ViewPreset =
  | "iso"
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export interface Arrow {
  id: string;
  from: Vec3;
  to: Vec3;
  color: string;
}

export interface PartStepState {
  visible: boolean;
  pose?: Pose; // frozen pose captured when the view was inserted
  highlightColor?: string; // fill tint
  outlineColor?: string; // edge/border color to call out the part
  opacity?: number; // 0..1, useful combined with xray
}

/**
 * One inserted, frozen orthographic projection of the assembly -- like a
 * SolidWorks drawing view. Captures part poses/visibility at insertion time
 * plus its own camera direction, render mode, and annotations (arrows,
 * outline colors). Placed on a Sheet at (x, y, width, height) in sheet
 * space (CSS px at 1:1 zoom) so several views can sit side by side and be
 * dragged around independently of the 3D scene.
 */
export interface ViewInstance {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  viewPreset: ViewPreset;
  renderMode: RenderMode;
  partStates: Record<string, PartStepState>; // partId -> state
  arrows: Arrow[];
}

/** A drawing page/canvas holding one or more inserted views. */
export interface Sheet {
  id: string;
  name: string;
  views: ViewInstance[];
}
