import { useAssemblyStore } from "../assembly/store";

export default function PartsPanel() {
  const partOrder = useAssemblyStore((s) => s.partOrder);
  const parts = useAssemblyStore((s) => s.parts);
  const selectedPartId = useAssemblyStore((s) => s.selectedPartId);
  const selectPart = useAssemblyStore((s) => s.selectPart);
  const setPartVisible = useAssemblyStore((s) => s.setPartVisible);
  const setPartColor = useAssemblyStore((s) => s.setPartColor);

  const isPlanMode = useAssemblyStore((s) => s.isPlanMode);
  const currentPlanId = useAssemblyStore((s) => s.currentPlanId);
  const currentStepIndex = useAssemblyStore((s) => s.currentStepIndex);
  const plans = useAssemblyStore((s) => s.plans);
  const setPartStepState = useAssemblyStore((s) => s.setPartStepState);

  const step =
    isPlanMode && currentPlanId
      ? plans[currentPlanId]?.steps[currentStepIndex]
      : null;

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
        const stepState = step?.partStates[id];
        const visible = step ? stepState?.visible ?? false : part.visible;
        const outline = stepState?.outlineColor ?? "";

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
              checked={visible}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (step && currentPlanId) {
                  setPartStepState(currentPlanId, step.id, id, {
                    visible: e.target.checked,
                  });
                } else {
                  setPartVisible(id, e.target.checked);
                }
              }}
            />
            <span className="flex-1 truncate text-neutral-200">
              {part.name}
            </span>
            {!step && (
              <input
                type="color"
                value={part.color}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setPartColor(id, e.target.value)}
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                title="Color de la pieza"
              />
            )}
            {step && (
              <input
                type="color"
                value={outline || "#ff9900"}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setPartStepState(currentPlanId!, step.id, id, {
                    outlineColor: e.target.value,
                  })
                }
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                title="Color de contorno (para señalar en este paso)"
              />
            )}
            {step && outline && (
              <button
                className="text-xs text-neutral-400 hover:text-neutral-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setPartStepState(currentPlanId!, step.id, id, {
                    outlineColor: undefined,
                  });
                }}
              >
                x
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
