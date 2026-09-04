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
  const arrowToolActive = useAssemblyStore((s) => s.arrowToolActive);
  const setArrowToolActive = useAssemblyStore((s) => s.setArrowToolActive);
  const deleteArrow = useAssemblyStore((s) => s.deleteArrow);

  const [newPlanName, setNewPlanName] = useState("Dibujo 1");

  const plan = currentPlanId ? plans[currentPlanId] : null;
  const step = plan && isPlanMode ? plan.steps[currentStepIndex] : null;

  return (
    <div className="flex flex-col border-t border-neutral-800">
      <div className="p-2 flex gap-2 items-center">
        <select
          className="flex-1 bg-neutral-800 text-sm rounded px-2 py-1"
          value={currentPlanId ?? ""}
          onChange={(e) => setCurrentPlan(e.target.value || null)}
        >
          <option value="">-- sin dibujo --</option>
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
          onClick={() => createPlan(newPlanName || "Dibujo")}
        >
          + Dibujo nuevo
        </button>
      </div>

      {plan && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pb-1">
            <button
              className="w-full px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
              onClick={() => addStep(plan.id, true)}
              title="Inserta una vista fija (proyeccion ortografica) del ensamble tal como esta acomodado ahora mismo en el editor 3D"
            >
              + Insertar vista (congela el ensamble actual)
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
              Sin vistas todavia. Primero acomoda las piezas como quieras en
              el editor 3D (arriba, con el dibujo cerrado), luego vuelve aqui
              y presiona "Insertar vista" para congelar ese acomodo como una
              vista del dibujo.
            </div>
          )}

          {step && (
            <div className="p-2 border-t border-neutral-800">
              <button
                className={`w-full px-2 py-1 rounded text-sm ${
                  arrowToolActive
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-neutral-800 hover:bg-neutral-700"
                }`}
                onClick={() => setArrowToolActive(!arrowToolActive)}
              >
                {arrowToolActive
                  ? "Haz clic en el origen y luego el destino de la flecha..."
                  : "+ Agregar flecha (click, click)"}
              </button>
              {step.arrows.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {step.arrows.map((a, i) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 text-xs text-neutral-400"
                    >
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ background: a.color }}
                      />
                      <span className="flex-1">Flecha {i + 1}</span>
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteArrow(plan.id, step.id, a.id)}
                      >
                        x
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
