import { useAssemblyStore } from "../assembly/store";
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

export default function ViewInspector() {
  const currentSheetId = useAssemblyStore((s) => s.currentSheetId);
  const activeViewId = useAssemblyStore((s) => s.activeViewId);
  const sheets = useAssemblyStore((s) => s.sheets);
  const parts = useAssemblyStore((s) => s.parts);
  const partOrder = useAssemblyStore((s) => s.partOrder);
  const updateView = useAssemblyStore((s) => s.updateView);
  const setViewPartState = useAssemblyStore((s) => s.setViewPartState);
  const arrowToolActive = useAssemblyStore((s) => s.arrowToolActive);
  const setArrowToolActive = useAssemblyStore((s) => s.setArrowToolActive);
  const deleteArrowFromView = useAssemblyStore((s) => s.deleteArrowFromView);

  const sheet = currentSheetId ? sheets[currentSheetId] : null;
  const view = sheet?.views.find((v) => v.id === activeViewId) ?? null;

  if (!sheet || !view) {
    return (
      <div className="p-3 text-neutral-500 text-xs">
        Selecciona una vista en el canvas para editar su direccion, modo de
        render, flechas y colores de contorno.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto flex-1 text-sm">
      <div className="p-2 border-b border-neutral-800">
        <div className="text-neutral-400 text-xs mb-1">Direccion</div>
        <div className="flex flex-wrap gap-1">
          {VIEW_PRESETS.map((v) => (
            <button
              key={v.id}
              onClick={() =>
                updateView(sheet.id, view.id, { viewPreset: v.id })
              }
              className={`px-2 py-1 rounded text-xs ${
                view.viewPreset === v.id
                  ? "bg-blue-600"
                  : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2 border-b border-neutral-800">
        <div className="text-neutral-400 text-xs mb-1">Modo</div>
        <div className="flex flex-wrap gap-1">
          {RENDER_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() =>
                updateView(sheet.id, view.id, { renderMode: m.id })
              }
              className={`px-2 py-1 rounded text-xs ${
                view.renderMode === m.id
                  ? "bg-blue-600"
                  : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2 border-b border-neutral-800">
        <button
          className={`w-full px-2 py-1 rounded text-xs ${
            arrowToolActive
              ? "bg-rose-600 hover:bg-rose-500"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
          onClick={() => setArrowToolActive(!arrowToolActive)}
        >
          {arrowToolActive
            ? "Haz clic en el origen y luego el destino..."
            : "+ Agregar flecha (click, click)"}
        </button>
        {view.arrows.length > 0 && (
          <ul className="mt-2 space-y-1">
            {view.arrows.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 text-xs text-neutral-400">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ background: a.color }}
                />
                <span className="flex-1">Flecha {i + 1}</span>
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteArrowFromView(sheet.id, view.id, a.id)}
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-2">
        <div className="text-neutral-400 text-xs mb-1">
          Piezas en esta vista
        </div>
        {partOrder.map((id) => {
          const part = parts[id];
          if (!part) return null;
          const state = view.partStates[id];
          if (!state) return null;
          return (
            <div key={id} className="flex items-center gap-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={state.visible}
                onChange={(e) =>
                  setViewPartState(sheet.id, view.id, id, {
                    visible: e.target.checked,
                  })
                }
              />
              <span className="flex-1 truncate">{part.name}</span>
              <input
                type="color"
                value={state.outlineColor || "#ff9900"}
                onChange={(e) =>
                  setViewPartState(sheet.id, view.id, id, {
                    outlineColor: e.target.value,
                  })
                }
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                title="Color de contorno (para señalar esta pieza)"
              />
              {state.outlineColor && (
                <button
                  className="text-neutral-500 hover:text-neutral-300"
                  onClick={() =>
                    setViewPartState(sheet.id, view.id, id, {
                      outlineColor: undefined,
                    })
                  }
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
