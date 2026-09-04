import { useAssemblyStore } from "../assembly/store";

export default function PartsPanel() {
  const partOrder = useAssemblyStore((s) => s.partOrder);
  const parts = useAssemblyStore((s) => s.parts);
  const selectedPartId = useAssemblyStore((s) => s.selectedPartId);
  const selectPart = useAssemblyStore((s) => s.selectPart);
  const setPartVisible = useAssemblyStore((s) => s.setPartVisible);
  const setPartColor = useAssemblyStore((s) => s.setPartColor);
  const splitPart = useAssemblyStore((s) => s.splitPart);

  if (partOrder.length === 0) {
    return (
      <div className="p-3 text-neutral-500 text-sm">
        Importa un modelo CAD para ver las piezas aqui.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {partOrder.map((id) => {
        const part = parts[id];
        if (!part) return null;

        return (
          <div
            key={id}
            onClick={() => selectPart(id)}
            className={`flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer border-b border-neutral-800 ${
              selectedPartId === id ? "bg-blue-900/50" : "hover:bg-neutral-800"
            }`}
          >
            <input
              type="checkbox"
              checked={part.visible}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setPartVisible(id, e.target.checked)}
            />
            <span className="flex-1 truncate text-neutral-200">
              {part.name}
            </span>
            <button
              className="text-xs text-neutral-400 hover:text-neutral-200"
              title="Separar esta pieza en sus cuerpos independientes (util si un ensamble se importo como una sola pieza)"
              onClick={(e) => {
                e.stopPropagation();
                splitPart(id);
              }}
            >
              separar
            </button>
            <input
              type="color"
              value={part.color}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setPartColor(id, e.target.value)}
              className="w-6 h-6 bg-transparent border-0 cursor-pointer"
              title="Color de la pieza"
            />
          </div>
        );
      })}
    </div>
  );
}
