import { useState } from "react";
import { useAssemblyStore } from "../assembly/store";

export default function PlansPanel() {
  const planOrder = useAssemblyStore((s) => s.planOrder);
  const plans = useAssemblyStore((s) => s.plans);
  const currentPlanId = useAssemblyStore((s) => s.currentPlanId);
  const currentStepIndex = useAssemblyStore((s) => s.currentStepIndex);
  const createPlan = useAssemblyStore((s) => s.createPlan);
  const deletePlan = useAssemblyStore((s) => s.deletePlan);
  const setCurrentPlan = useAssemblyStore((s) => s.setCurrentPlan);
  const addStep = useAssemblyStore((s) => s.addStep);
  const deleteStep = useAssemblyStore((s) => s.deleteStep);
  const duplicateStep = useAssemblyStore((s) => s.duplicateStep);
  const goToStep = useAssemblyStore((s) => s.goToStep);
  const isPlanMode = useAssemblyStore((s) => s.isPlanMode);

  const [newPlanName, setNewPlanName] = useState("Guia de ensamble");

  const plan = currentPlanId ? plans[currentPlanId] : null;

  return (
    <div className="flex flex-col border-t border-neutral-800">
      <div className="p-2 flex gap-2 items-center">
        <select
          className="flex-1 bg-neutral-800 text-sm rounded px-2 py-1"
          value={currentPlanId ?? ""}
          onChange={(e) => setCurrentPlan(e.target.value || null)}
        >
          <option value="">-- sin plano --</option>
          {planOrder.map((id) => (
            <option key={id} value={id}>
              {plans[id].name}
            </option>
          ))}
        </select>
        {currentPlanId && (
          <button
            className="text-xs text-red-400 hover:text-red-300"
            onClick={() => deletePlan(currentPlanId)}
          >
            eliminar
          </button>
        )}
      </div>

      <div className="p-2 flex gap-2">
        <input
          className="flex-1 bg-neutral-800 text-sm rounded px-2 py-1"
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
        />
        <button
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
          onClick={() => createPlan(newPlanName || "Plano")}
        >
          + Plano nuevo
        </button>
      </div>

      {plan && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pb-1">
            <button
              className="w-full px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
              onClick={() => addStep(plan.id, true)}
            >
              + Agregar paso (captura ensamble actual)
            </button>
          </div>
          {plan.steps.map((step, i) => (
            <div
              key={step.id}
              onClick={() => goToStep(i)}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer border-b border-neutral-800 ${
                isPlanMode && currentStepIndex === i
                  ? "bg-emerald-900/50"
                  : "hover:bg-neutral-800"
              }`}
            >
              <span className="w-5 text-neutral-500">{i + 1}</span>
              <span className="flex-1 truncate">{step.name}</span>
              <button
                className="text-xs text-neutral-400 hover:text-neutral-200"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateStep(plan.id, step.id);
                }}
              >
                duplicar
              </button>
              <button
                className="text-xs text-red-400 hover:text-red-300"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteStep(plan.id, step.id);
                }}
              >
                x
              </button>
            </div>
          ))}
          {plan.steps.length === 0 && (
            <div className="p-2 text-neutral-500 text-xs">
              Sin pasos todavia. Mueve las piezas a la posicion que quieras
              mostrar y presiona "Agregar paso".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
