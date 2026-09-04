import { create } from "zustand";
import type {
  Arrow,
  Part,
  Plan,
  PlanStep,
  Pose,
  RenderMode,
  ViewPreset,
  PartStepState,
  Vec3,
} from "../types/domain";
import { identityPose } from "../types/domain";

let uid = 0;
export function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}_${Date.now().toString(36)}_${uid}`;
}

interface AssemblyState {
  parts: Record<string, Part>;
  partOrder: string[];
  poses: Record<string, Pose>; // current assembly pose per part (live, editable)
  selectedPartId: string | null;

  plans: Record<string, Plan>;
  planOrder: string[];
  currentPlanId: string | null;
  currentStepIndex: number;

  viewPreset: ViewPreset;
  renderMode: RenderMode;
  /** when set, we are looking at a plan step instead of free assembly editing */
  isPlanMode: boolean;
  /** when true, next two clicks in the viewport define a new arrow on the current step */
  arrowToolActive: boolean;

  addParts: (parts: Part[]) => void;
  clearParts: () => void;
  selectPart: (id: string | null) => void;
  setPartPose: (id: string, pose: Pose) => void;
  setPartColor: (id: string, color: string) => void;
  setPartVisible: (id: string, visible: boolean) => void;

  setViewPreset: (v: ViewPreset) => void;
  setRenderMode: (m: RenderMode) => void;

  createPlan: (name: string) => string;
  deletePlan: (id: string) => void;
  setCurrentPlan: (id: string | null) => void;
  addStep: (planId: string, fromCurrentAssembly?: boolean) => string;
  deleteStep: (planId: string, stepId: string) => void;
  duplicateStep: (planId: string, stepId: string) => string;
  goToStep: (index: number) => void;
  updateStep: (planId: string, stepId: string, patch: Partial<PlanStep>) => void;
  setPartStepState: (
    planId: string,
    stepId: string,
    partId: string,
    patch: Partial<PartStepState>
  ) => void;
  exitPlanMode: () => void;

  setArrowToolActive: (active: boolean) => void;
  addArrow: (planId: string, stepId: string, from: Vec3, to: Vec3, color?: string) => void;
  deleteArrow: (planId: string, stepId: string, arrowId: string) => void;
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  parts: {},
  partOrder: [],
  poses: {},
  selectedPartId: null,

  plans: {},
  planOrder: [],
  currentPlanId: null,
  currentStepIndex: 0,

  viewPreset: "iso",
  renderMode: "shaded",
  isPlanMode: false,
  arrowToolActive: false,

  addParts: (parts) =>
    set((s) => {
      const nextParts = { ...s.parts };
      const nextPoses = { ...s.poses };
      const order = [...s.partOrder];
      for (const p of parts) {
        nextParts[p.id] = p;
        nextPoses[p.id] = p.basePose;
        order.push(p.id);
      }
      return { parts: nextParts, poses: nextPoses, partOrder: order };
    }),

  clearParts: () =>
    set({ parts: {}, partOrder: [], poses: {}, selectedPartId: null }),

  selectPart: (id) => set({ selectedPartId: id }),

  setPartPose: (id, pose) =>
    set((s) => ({ poses: { ...s.poses, [id]: pose } })),

  setPartColor: (id, color) =>
    set((s) => ({
      parts: { ...s.parts, [id]: { ...s.parts[id], color } },
    })),

  setPartVisible: (id, visible) =>
    set((s) => ({
      parts: { ...s.parts, [id]: { ...s.parts[id], visible } },
    })),

  setViewPreset: (v) => set({ viewPreset: v }),
  setRenderMode: (m) => set({ renderMode: m }),

  createPlan: (name) => {
    const id = nextId("plan");
    const plan: Plan = { id, name, steps: [] };
    set((s) => ({
      plans: { ...s.plans, [id]: plan },
      planOrder: [...s.planOrder, id],
      currentPlanId: id,
    }));
    return id;
  },

  deletePlan: (id) =>
    set((s) => {
      const plans = { ...s.plans };
      delete plans[id];
      return {
        plans,
        planOrder: s.planOrder.filter((p) => p !== id),
        currentPlanId: s.currentPlanId === id ? null : s.currentPlanId,
        isPlanMode: s.currentPlanId === id ? false : s.isPlanMode,
      };
    }),

  setCurrentPlan: (id) => set({ currentPlanId: id, currentStepIndex: 0 }),

  addStep: (planId, fromCurrentAssembly = true) => {
    const s = get();
    const plan = s.plans[planId];
    if (!plan) return "";
    const id = nextId("step");
    const partStates: Record<string, PartStepState> = {};
    for (const pid of s.partOrder) {
      partStates[pid] = {
        visible: s.parts[pid].visible,
        pose: fromCurrentAssembly ? s.poses[pid] : undefined,
      };
    }
    const step: PlanStep = {
      id,
      name: `Paso ${plan.steps.length + 1}`,
      viewPreset: s.viewPreset,
      renderMode: s.renderMode,
      partStates,
      arrows: [],
    };
    set((st) => ({
      plans: {
        ...st.plans,
        [planId]: { ...plan, steps: [...plan.steps, step] },
      },
      currentStepIndex: plan.steps.length,
      isPlanMode: true,
      currentPlanId: planId,
    }));
    return id;
  },

  deleteStep: (planId, stepId) =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return {};
      const steps = plan.steps.filter((st) => st.id !== stepId);
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    }),

  duplicateStep: (planId, stepId) => {
    const s = get();
    const plan = s.plans[planId];
    if (!plan) return "";
    const src = plan.steps.find((st) => st.id === stepId);
    if (!src) return "";
    const id = nextId("step");
    const copy: PlanStep = {
      ...src,
      id,
      name: `${src.name} (copia)`,
      partStates: JSON.parse(JSON.stringify(src.partStates)),
      arrows: src.arrows.map((a) => ({ ...a, id: nextId("arrow") })),
    };
    const idx = plan.steps.findIndex((st) => st.id === stepId);
    const steps = [...plan.steps];
    steps.splice(idx + 1, 0, copy);
    set({ plans: { ...s.plans, [planId]: { ...plan, steps } } });
    return id;
  },

  goToStep: (index) => set({ currentStepIndex: index, isPlanMode: true }),

  updateStep: (planId, stepId, patch) =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return {};
      const steps = plan.steps.map((st) =>
        st.id === stepId ? { ...st, ...patch } : st
      );
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    }),

  setPartStepState: (planId, stepId, partId, patch) =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return {};
      const steps = plan.steps.map((st) => {
        if (st.id !== stepId) return st;
        const existing: PartStepState = st.partStates[partId] ?? {
          visible: true,
        };
        return {
          ...st,
          partStates: {
            ...st.partStates,
            [partId]: { ...existing, ...patch },
          },
        };
      });
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    }),

  exitPlanMode: () => set({ isPlanMode: false }),

  setArrowToolActive: (active) => set({ arrowToolActive: active }),

  addArrow: (planId, stepId, from, to, color = "#ff2d55") =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return {};
      const steps = plan.steps.map((st) =>
        st.id === stepId
          ? {
              ...st,
              arrows: [
                ...st.arrows,
                { id: nextId("arrow"), from, to, color } as Arrow,
              ],
            }
          : st
      );
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    }),

  deleteArrow: (planId, stepId, arrowId) =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return {};
      const steps = plan.steps.map((st) =>
        st.id === stepId
          ? { ...st, arrows: st.arrows.filter((a) => a.id !== arrowId) }
          : st
      );
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    }),
}));

export function defaultPartStepState(): PartStepState {
  return { visible: true, pose: identityPose() };
}
