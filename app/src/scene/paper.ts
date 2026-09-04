import type { PaperSize } from "../types/domain";

// ISO 216 sizes, portrait, in mm.
export const PAPER_SIZE_MM: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
};

export const PX_PER_MM = 96 / 25.4; // CSS px per mm at 96dpi

export function paperSizePx(paper: PaperSize): { width: number; height: number } {
  const mm = PAPER_SIZE_MM[paper];
  return { width: mm.width * PX_PER_MM, height: mm.height * PX_PER_MM };
}

export const SCALE_OPTIONS: { label: string; value: number }[] = [
  { label: "2:1", value: 2 },
  { label: "1:1", value: 1 },
  { label: "1:2", value: 0.5 },
  { label: "1:5", value: 0.2 },
  { label: "1:10", value: 0.1 },
  { label: "1:20", value: 0.05 },
  { label: "1:30", value: 1 / 30 },
  { label: "1:50", value: 0.02 },
  { label: "1:100", value: 0.01 },
];
