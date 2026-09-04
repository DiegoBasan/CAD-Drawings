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
  pose?: Pose; // override pose for this step (e.g. exploded position); undefined = use assembly pose
  highlightColor?: string; // fill tint
  outlineColor?: string; // edge/border color to call out the part
  opacity?: number; // 0..1, useful combined with xray
}

export interface PlanStep {
  id: string;
  name: string;
  viewPreset: ViewPreset;
  renderMode: RenderMode;
  partStates: Record<string, PartStepState>; // partId -> state
  arrows: Arrow[];
  notes?: string;
}

export interface Plan {
  id: string;
  name: string;
  steps: PlanStep[];
}
