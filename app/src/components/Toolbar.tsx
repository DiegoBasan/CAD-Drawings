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
  const tab = useAssemblyStore((s) => s.tab);
  const setTab = useAssemblyStore((s) => s.setTab);

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

      <div className="flex rounded overflow-hidden border border-neutral-700">
        <button
          className={`px-3 py-1 ${
            tab === "3d" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700"
          }`}
          onClick={() => setTab("3d")}
        >
          Ensamble 3D
        </button>
        <button
          className={`px-3 py-1 ${
            tab === "2d" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700"
          }`}
          onClick={() => setTab("2d")}
        >
          Dibujo 2D
        </button>
      </div>

      {tab === "3d" && (
        <>
          <div className="w-px h-6 bg-neutral-700 mx-1" />
          <span className="text-neutral-400">Vista:</span>
          {VIEW_PRESETS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewPreset(v.id)}
              className={`px-2 py-1 rounded ${
                viewPreset === v.id
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
              onClick={() => setRenderMode(m.id)}
              className={`px-2 py-1 rounded ${
                renderMode === m.id
                  ? "bg-blue-600"
                  : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
