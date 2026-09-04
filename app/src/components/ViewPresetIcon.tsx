import type { ViewPreset } from "../types/domain";

interface Props {
  preset: ViewPreset;
  className?: string;
}

/** Minimal axonometric-cube glyphs, one style reused/mirrored per preset
 * rather than ten hand-authored icons: an orthographic view is a flat
 * square with a direction arrow, an isometric view is a 3-face cube with
 * the "up" face tinted, mirrored/rotated to approximate each of the four
 * corners the assembly can be viewed from. */
export default function ViewPresetIcon({ preset, className }: Props) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", className };

  switch (preset) {
    case "front":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.1" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" />
        </svg>
      );
    case "top":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <path d="M12 15V7M8.5 10.5L12 7l3.5 3.5" stroke="currentColor" fill="none" />
        </svg>
      );
    case "bottom":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <path d="M12 9v8M8.5 13.5L12 17l3.5-3.5" stroke="currentColor" fill="none" />
        </svg>
      );
    case "left":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <path d="M15 12H7M10.5 8.5L7 12l3.5 3.5" stroke="currentColor" fill="none" />
        </svg>
      );
    case "right":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.25" />
          <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" />
          <path d="M9 12h8M13.5 8.5L17 12l-3.5 3.5" stroke="currentColor" fill="none" />
        </svg>
      );
    case "isoTopA":
    case "isoTopB":
    case "isoBottomA":
    case "isoBottomB": {
      // base cube glyph: top face + two side faces
      const flipX = preset === "isoTopB" || preset === "isoBottomB";
      const flipY = preset === "isoBottomA" || preset === "isoBottomB";
      const transform = `${flipX ? "scale(-1,1) translate(-24,0)" : ""} ${
        flipY ? "scale(1,-1) translate(0,-24)" : ""
      }`.trim();
      return (
        <svg {...common}>
          <g transform={transform || undefined}>
            <path d="M12 4l7 4v4l-7 4-7-4V8z" fill="currentColor" opacity="0.08" stroke="currentColor" />
            <path d="M12 4l7 4-7 4-7-4z" fill="currentColor" opacity="0.35" stroke="currentColor" />
            <path d="M12 12v8" stroke="currentColor" />
            <path d="M5 8v4l7 4" stroke="currentColor" fill="none" />
            <path d="M19 8v4l-7 4" stroke="currentColor" fill="none" />
          </g>
        </svg>
      );
    }
  }
}
