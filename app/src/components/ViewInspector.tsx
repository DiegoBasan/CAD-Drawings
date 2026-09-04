import { useAssemblyStore } from "../assembly/store";
import { SCALE_OPTIONS } from "../scene/paper";
import { VIEW_PRESET_LABEL } from "../scene/viewPresets";
import ViewPresetIcon from "./ViewPresetIcon";
import type { RenderMode, ViewPreset } from "../types/domain";

const VIEW_PRESETS: ViewPreset[] = [
  "front",
  "right",
  "left",
  "back",
  "top",
  "bottom",
  "isoTopA",
  "isoTopB",
  "isoBottomA",
  "isoBottomB",
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
  const penToolActive = useAssemblyStore((s) => s.penToolActive);
  const setPenToolActive = useAssemblyStore((s) => s.setPenToolActive);
  const penStyle = useAssemblyStore((s) => s.penStyle);
  const setPenStyle = useAssemblyStore((s) => s.setPenStyle);
  const deleteAnnotation = useAssemblyStore((s) => s.deleteAnnotation);

  const sheet = currentSheetId ? sheets[currentSheetId] : null;
  const view = sheet?.views.find((v) => v.id === activeViewId) ?? null;

  if (!sheet || !view) {
    return (
      <div className="p-3 text-neutral-500 text-xs">
        Selecciona una vista en el canvas para editar su direccion, escala,
        modo de render, anotaciones y colores de contorno.
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
              key={v}
              onClick={() => updateView(sheet.id, view.id, { viewPreset: v })}
              title={VIEW_PRESET_LABEL[v]}
              className={`p-1 rounded ${
                view.viewPreset === v
                  ? "bg-blue-600"
                  : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              <ViewPresetIcon preset={v} />
            </button>
          ))}
        </div>
      </div>

      <div className="p-2 border-b border-neutral-800">
        <div className="text-neutral-400 text-xs mb-1">Escala</div>
        <select
          className="w-full bg-neutral-800 text-xs rounded px-2 py-1"
          value={view.scale}
          onChange={(e) =>
            updateView(sheet.id, view.id, { scale: Number(e.target.value) })
          }
        >
          {SCALE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
        <div className="text-neutral-400 text-xs mb-1">Pluma (anotaciones)</div>
        <button
          className={`w-full px-2 py-1 rounded text-xs mb-2 ${
            penToolActive
              ? "bg-rose-600 hover:bg-rose-500"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
          onClick={() => setPenToolActive(!penToolActive)}
        >
          {penToolActive
            ? "Dibujando: clic para agregar puntos, doble clic/Enter para terminar, Esc cancela"
            : "+ Trazo nuevo"}
        </button>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="color"
            value={penStyle.color}
            onChange={(e) => setPenStyle({ color: e.target.value })}
            className="w-6 h-6 bg-transparent border-0 cursor-pointer"
            title="Color del trazo"
          />
          <input
            type="range"
            min={1}
            max={10}
            value={penStyle.strokeWidth}
            onChange={(e) => setPenStyle({ strokeWidth: Number(e.target.value) })}
            className="flex-1"
            title="Grosor"
          />
          <span className="text-xs text-neutral-400 w-6 text-right">
            {penStyle.strokeWidth}px
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-300">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={penStyle.dashed}
              onChange={(e) => setPenStyle({ dashed: e.target.checked })}
            />
            Discontinua
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={penStyle.rounded}
              onChange={(e) => setPenStyle({ rounded: e.target.checked })}
            />
            Borde redondeado
          </label>
        </div>
        {view.annotations.length > 0 && (
          <ul className="mt-2 space-y-1">
            {view.annotations.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 text-xs text-neutral-400">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ background: a.color }}
                />
                <span className="flex-1">Trazo {i + 1}</span>
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteAnnotation(sheet.id, view.id, a.id)}
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
