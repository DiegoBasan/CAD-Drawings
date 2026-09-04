import { useState } from "react";
import { useAssemblyStore } from "../assembly/store";
import DrawingViewBox from "../scene/DrawingViewBox";
import type { ViewPreset } from "../types/domain";

const INSERT_PRESETS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "+ Vista frontal" },
  { id: "right", label: "+ Vista lateral" },
  { id: "top", label: "+ Vista superior" },
  { id: "iso", label: "+ Vista isometrica" },
];

export default function DrawingCanvas() {
  const sheetOrder = useAssemblyStore((s) => s.sheetOrder);
  const sheets = useAssemblyStore((s) => s.sheets);
  const currentSheetId = useAssemblyStore((s) => s.currentSheetId);
  const createSheet = useAssemblyStore((s) => s.createSheet);
  const deleteSheet = useAssemblyStore((s) => s.deleteSheet);
  const setCurrentSheet = useAssemblyStore((s) => s.setCurrentSheet);
  const insertView = useAssemblyStore((s) => s.insertView);
  const activeViewId = useAssemblyStore((s) => s.activeViewId);
  const setActiveView = useAssemblyStore((s) => s.setActiveView);
  const partOrder = useAssemblyStore((s) => s.partOrder);

  const [sheetCount, setSheetCount] = useState(0);

  const sheet = currentSheetId ? sheets[currentSheetId] : null;

  function handleNewSheet() {
    const n = sheetCount + 1;
    setSheetCount(n);
    createSheet(`Hoja ${n}`);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-sm flex-wrap">
        <div className="flex gap-1 items-center">
          {sheetOrder.map((id) => (
            <button
              key={id}
              onClick={() => setCurrentSheet(id)}
              className={`px-2 py-1 rounded text-xs ${
                currentSheetId === id
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {sheets[id].name}
            </button>
          ))}
          <button
            className="px-2 py-1 rounded text-xs bg-emerald-700 hover:bg-emerald-600"
            onClick={handleNewSheet}
          >
            + Nuevo canvas
          </button>
          {currentSheetId && (
            <button
              className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300"
              onClick={() => deleteSheet(currentSheetId)}
            >
              eliminar hoja
            </button>
          )}
        </div>

        {sheet && (
          <>
            <div className="w-px h-6 bg-neutral-700 mx-1" />
            {partOrder.length === 0 ? (
              <span className="text-neutral-500 text-xs">
                Importa piezas en la pestaña "Ensamble 3D" primero.
              </span>
            ) : (
              INSERT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700"
                  onClick={() => insertView(sheet.id, p.id)}
                  title="Congela el acomodo actual del ensamble 3D como una vista fija en este canvas"
                >
                  {p.label}
                </button>
              ))
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-neutral-950">
        {!sheet ? (
          <div className="p-8 text-neutral-500 text-sm">
            Crea un canvas ("+ Nuevo canvas") para empezar a insertar vistas
            del ensamble.
          </div>
        ) : (
          <div
            className="relative bg-white"
            style={{ width: 2000, height: 1400 }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setActiveView(null);
            }}
          >
            {sheet.views.map((view) => (
              <DrawingViewBox
                key={view.id}
                sheetId={sheet.id}
                view={view}
                isActive={activeViewId === view.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
