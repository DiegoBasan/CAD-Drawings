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
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "isoTopA" // default iso: top corner, +x -y +z
  | "isoTopB" // opposite top corner: -x +y +z
  | "isoBottomA" // top corner mirrored down: +x -y -z
  | "isoBottomB"; // opposite corner mirrored down: -x +y -z

export interface PartStepState {
  visible: boolean;
  pose?: Pose; // frozen pose captured when the view was inserted
  highlightColor?: string; // fill tint
  outlineColor?: string; // edge/border color to call out the part
  opacity?: number; // 0..1, useful combined with xray
}

/** A freehand annotation stroke drawn on top of a view, Figma-pen-style.
 * Points are fractions (0..1) of the view's current rendered box, so the
 * stroke stays aligned with the view if its size changes (e.g. its scale
 * is edited later). */
export interface Annotation {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number; // px
  dashed: boolean;
  rounded: boolean; // round line joins/caps vs. sharp miter/butt
}

export type PaperSize = "A4" | "A3" | "A2" | "A1";

/**
 * One inserted, frozen orthographic projection of the assembly -- like a
 * SolidWorks drawing view. Captures part poses/visibility at insertion time
 * plus its own camera direction, render mode, and annotations. Placed on a
 * Sheet at (x, y) in sheet space; its rendered size is NOT freely resizable
 * -- it's derived from the real-world size of the frozen geometry and the
 * chosen drawing `scale` (e.g. 1:2), same as inserting a view in a
 * SolidWorks drawing.
 */
export interface ViewInstance {
  id: string;
  label: string;
  x: number;
  y: number;
  scale: number; // drawing-units per model-unit, e.g. 0.5 for "1:2", 2 for "2:1"
  viewPreset: ViewPreset;
  renderMode: RenderMode;
  partStates: Record<string, PartStepState>; // partId -> state
  annotations: Annotation[];
}

/** A drawing page/canvas holding one or more inserted views. */
export interface Sheet {
  id: string;
  name: string;
  paperSize: PaperSize;
  views: ViewInstance[];
}
