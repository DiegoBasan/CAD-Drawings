import { create } from "zustand";
import type {
  Annotation,
  PaperSize,
  Part,
  Pose,
  RenderMode,
  Sheet,
  ViewPreset,
  ViewInstance,
  PartStepState,
} from "../types/domain";
import { splitPartIntoParts } from "../importers/splitMesh";

let uid = 0;
export function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}_${Date.now().toString(36)}_${uid}`;
}

const VIEW_PRESET_SHORT_LABEL: Record<ViewPreset, string> = {
  front: "Frontal",
  back: "Posterior",
  left: "Lat. izq.",
  right: "Lat. der.",
  top: "Superior",
  bottom: "Inferior",
  isoTopA: "Isometrica",
  isoTopB: "Isometrica B",
  isoBottomA: "Iso. inferior",
  isoBottomB: "Iso. inferior B",
};

const VIEW_INSERT_OFFSET = 24;

interface AssemblyState {
  parts: Record<string, Part>;
  partOrder: string[];
  poses: Record<string, Pose>; // current assembly pose per part (live, editable, 3D tab)
  selectedPartId: string | null;

  viewPreset: ViewPreset; // 3D tab camera preset
  renderMode: RenderMode; // 3D tab render mode

  tab: "3d" | "2d";

  sheets: Record<string, Sheet>;
  sheetOrder: string[];
  currentSheetId: string | null;
  /** which view (within the current sheet) annotation tools apply to */
  activeViewId: string | null;
  penToolActive: boolean;
  penStyle: { color: string; strokeWidth: number; dashed: boolean; rounded: boolean };

  addParts: (parts: Part[]) => void;
  clearParts: () => void;
  selectPart: (id: string | null) => void;
  setPartPose: (id: string, pose: Pose) => void;
  setPartColor: (id: string, color: string) => void;
  setPartVisible: (id: string, visible: boolean) => void;
  splitPart: (id: string) => void;

  setViewPreset: (v: ViewPreset) => void;
  setRenderMode: (m: RenderMode) => void;

  setTab: (tab: "3d" | "2d") => void;

  createSheet: (name: string, paperSize: PaperSize) => string;
  deleteSheet: (id: string) => void;
  setCurrentSheet: (id: string | null) => void;
  renameSheet: (id: string, name: string) => void;
  setSheetPaperSize: (id: string, paperSize: PaperSize) => void;

  insertView: (sheetId: string, viewPreset: ViewPreset) => string;
  deleteView: (sheetId: string, viewId: string) => void;
  moveView: (sheetId: string, viewId: string, x: number, y: number) => void;
  updateView: (
    sheetId: string,
    viewId: string,
    patch: Partial<
      Pick<ViewInstance, "viewPreset" | "renderMode" | "label" | "scale">
    >
  ) => void;
  setActiveView: (viewId: string | null) => void;

  setViewPartState: (
    sheetId: string,
    viewId: string,
    partId: string,
    patch: Partial<PartStepState>
  ) => void;

  setPenToolActive: (active: boolean) => void;
  setPenStyle: (patch: Partial<AssemblyState["penStyle"]>) => void;
  addAnnotation: (
    sheetId: string,
    viewId: string,
    points: { x: number; y: number }[]
  ) => void;
  deleteAnnotation: (sheetId: string, viewId: string, annotationId: string) => void;
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  parts: {},
  partOrder: [],
  poses: {},
  selectedPartId: null,

  viewPreset: "isoTopA",
  renderMode: "shaded",

  tab: "3d",

  sheets: {},
  sheetOrder: [],
  currentSheetId: null,
  activeViewId: null,
  penToolActive: false,
  penStyle: { color: "#ff2d55", strokeWidth: 2, dashed: false, rounded: true },

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

  splitPart: (id) => {
    const s = get();
    const part = s.parts[id];
    const pose = s.poses[id];
    if (!part || !pose) return;
    const newParts = splitPartIntoParts(part, pose);
    if (newParts.length <= 1) return; // already a single body

    set((st) => {
      const parts = { ...st.parts };
      const poses = { ...st.poses };
      delete parts[id];
      delete poses[id];
      const order = st.partOrder.filter((pid) => pid !== id);
      for (const np of newParts) {
        parts[np.id] = np;
        poses[np.id] = np.basePose;
        order.push(np.id);
      }
      return {
        parts,
        poses,
        partOrder: order,
        selectedPartId:
          st.selectedPartId === id ? null : st.selectedPartId,
      };
    });
  },

  setViewPreset: (v) => set({ viewPreset: v }),
  setRenderMode: (m) => set({ renderMode: m }),

  setTab: (tab) => set({ tab }),

  createSheet: (name, paperSize) => {
    const id = nextId("sheet");
    const sheet: Sheet = { id, name, paperSize, views: [] };
    set((s) => ({
      sheets: { ...s.sheets, [id]: sheet },
      sheetOrder: [...s.sheetOrder, id],
      currentSheetId: id,
      activeViewId: null,
    }));
    return id;
  },

  deleteSheet: (id) =>
    set((s) => {
      const sheets = { ...s.sheets };
      delete sheets[id];
      const sheetOrder = s.sheetOrder.filter((sid) => sid !== id);
      const wasCurrent = s.currentSheetId === id;
      return {
        sheets,
        sheetOrder,
        currentSheetId: wasCurrent
          ? sheetOrder[0] ?? null
          : s.currentSheetId,
        activeViewId: wasCurrent ? null : s.activeViewId,
      };
    }),

  setCurrentSheet: (id) => set({ currentSheetId: id, activeViewId: null }),

  renameSheet: (id, name) =>
    set((s) => {
      const sheet = s.sheets[id];
      if (!sheet) return {};
      return { sheets: { ...s.sheets, [id]: { ...sheet, name } } };
    }),

  setSheetPaperSize: (id, paperSize) =>
    set((s) => {
      const sheet = s.sheets[id];
      if (!sheet) return {};
      return { sheets: { ...s.sheets, [id]: { ...sheet, paperSize } } };
    }),

  insertView: (sheetId, viewPreset) => {
    const s = get();
    const sheet = s.sheets[sheetId];
    if (!sheet) return "";
    const id = nextId("view");
    const partStates: Record<string, PartStepState> = {};
    for (const pid of s.partOrder) {
      partStates[pid] = {
        visible: s.parts[pid].visible,
        pose: s.poses[pid],
      };
    }
    const insertIndex = sheet.views.length;
    const view: ViewInstance = {
      id,
      label: `${VIEW_PRESET_SHORT_LABEL[viewPreset]} ${insertIndex + 1}`,
      x: 24 + insertIndex * VIEW_INSERT_OFFSET,
      y: 24 + insertIndex * VIEW_INSERT_OFFSET,
      scale: 1,
      viewPreset,
      renderMode: "shaded",
      partStates,
      annotations: [],
    };
    set((st) => ({
      sheets: {
        ...st.sheets,
        [sheetId]: { ...sheet, views: [...sheet.views, view] },
      },
      activeViewId: id,
    }));
    return id;
  },

  deleteView: (sheetId, viewId) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.filter((v) => v.id !== viewId);
      return {
        sheets: { ...s.sheets, [sheetId]: { ...sheet, views } },
        activeViewId: s.activeViewId === viewId ? null : s.activeViewId,
      };
    }),

  moveView: (sheetId, viewId, x, y) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId ? { ...v, x, y } : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),

  updateView: (sheetId, viewId, patch) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId ? { ...v, ...patch } : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),

  setActiveView: (viewId) => set({ activeViewId: viewId }),

  setViewPartState: (sheetId, viewId, partId, patch) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) => {
        if (v.id !== viewId) return v;
        const existing: PartStepState = v.partStates[partId] ?? {
          visible: true,
        };
        return {
          ...v,
          partStates: { ...v.partStates, [partId]: { ...existing, ...patch } },
        };
      });
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),

  setPenToolActive: (active) => set({ penToolActive: active }),
  setPenStyle: (patch) =>
    set((s) => ({ penStyle: { ...s.penStyle, ...patch } })),

  addAnnotation: (sheetId, viewId, points) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const style = s.penStyle;
      const annotation: Annotation = {
        id: nextId("annot"),
        points,
        color: style.color,
        strokeWidth: style.strokeWidth,
        dashed: style.dashed,
        rounded: style.rounded,
      };
      const views = sheet.views.map((v) =>
        v.id === viewId
          ? { ...v, annotations: [...v.annotations, annotation] }
          : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),

  deleteAnnotation: (sheetId, viewId, annotationId) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId
          ? {
              ...v,
              annotations: v.annotations.filter((a) => a.id !== annotationId),
            }
          : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),
}));
