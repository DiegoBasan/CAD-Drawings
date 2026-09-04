import { useRef, useState } from "react";
import { useAssemblyStore } from "../assembly/store";
import { loadModelFile } from "../importers/loadModel";
import type { RenderMode, ViewPreset } from "../types/domain";

const VIEW_PRESETS: { id: ViewPreset; label: string }[] = [
  { id: "iso", label: "Isometrica" },
  { id: "front", label: "Frontal" },
  { id: "back", label: "Posterior" },
  { id: "left", label: "Izquierda" },
  { id: "right", label: "Derecha" },
  { id: "top", label: "Superior" },
  { id: "bottom", label: "Inferior" },
];

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "shaded", label: "Color" },
  { id: "xray", label: "Rayos X" },
  { id: "wireframe", label: "Armazon" },
  { id: "wireframe-xray", label: "Armazon Rayos X" },
];

export default function Toolbar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const addParts = useAssemblyStore((s) => s.addParts);
  const viewPreset = useAssemblyStore((s) => s.viewPreset);
  const renderMode = useAssemblyStore((s) => s.renderMode);
  const setViewPreset = useAssemblyStore((s) => s.setViewPreset);
  const setRenderMode = useAssemblyStore((s) => s.setRenderMode);
  const isPlanMode = useAssemblyStore((s) => s.isPlanMode);
  const exitPlanMode = useAssemblyStore((s) => s.exitPlanMode);
  const currentPlanId = useAssemblyStore((s) => s.currentPlanId);
  const currentStepIndex = useAssemblyStore((s) => s.currentStepIndex);
  const plans = useAssemblyStore((s) => s.plans);
  const updateStep = useAssemblyStore((s) => s.updateStep);

  const step =
    isPlanMode && currentPlanId
      ? plans[currentPlanId]?.steps[currentStepIndex]
      : null;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const parts = await loadModelFile(file);
          addParts(parts);
        } catch (err) {
          alert((err as Error).message);
        }
      }
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function pick(preset: ViewPreset) {
    if (step && currentPlanId) {
      updateStep(currentPlanId, step.id, { viewPreset: preset });
    } else {
      setViewPreset(preset);
    }
  }

  function pickMode(mode: RenderMode) {
    if (step && currentPlanId) {
      updateStep(currentPlanId, step.id, { renderMode: mode });
    } else {
      setRenderMode(mode);
    }
  }

  const activePreset = step ? step.viewPreset : viewPreset;
  const activeMode = step ? step.renderMode : renderMode;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-neutral-900 border-b border-neutral-700 px-3 py-2 text-sm text-neutral-200">
      <button
        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
      >
        {importing ? "Importando..." : "Importar CAD (STEP/STL/OBJ/glTF)"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".step,.stp,.iges,.igs,.stl,.obj,.glb,.gltf"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <div className="w-px h-6 bg-neutral-700 mx-1" />

      <span className="text-neutral-400">Vista:</span>
      {VIEW_PRESETS.map((v) => (
        <button
          key={v.id}
          onClick={() => pick(v.id)}
          className={`px-2 py-1 rounded ${
            activePreset === v.id
              ? "bg-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {v.label}
        </button>
      ))}

      <div className="w-px h-6 bg-neutral-700 mx-1" />

      <span className="text-neutral-400">Modo:</span>
      {RENDER_MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => pickMode(m.id)}
          className={`px-2 py-1 rounded ${
            activeMode === m.id
              ? "bg-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {m.label}
        </button>
      ))}

      {isPlanMode && (
        <>
          <div className="w-px h-6 bg-neutral-700 mx-1" />
          <span
            className="px-2 py-1 rounded bg-amber-900/60 text-amber-300 text-xs"
            title="Estas viendo una vista de dibujo: proyeccion fija, no se puede rotar la camara ni arrastrar piezas. Cambia la direccion de vista arriba si quieres, o sal a editar el ensamble."
          >
            🔒 Vista de dibujo (camara fija)
          </span>
          <button
            className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600"
            onClick={exitPlanMode}
          >
            Salir del dibujo (volver a acomodar piezas en 3D)
          </button>
        </>
      )}
    </div>
  );
}
