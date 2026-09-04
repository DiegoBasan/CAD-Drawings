import { create } from "zustand";
import type {
  Arrow,
  Part,
  Pose,
  RenderMode,
  Sheet,
  ViewPreset,
  ViewInstance,
  PartStepState,
  Vec3,
} from "../types/domain";

let uid = 0;
export function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}_${Date.now().toString(36)}_${uid}`;
}

const DEFAULT_VIEW_SIZE = { width: 420, height: 320 };
const VIEW_INSERT_OFFSET = 32;

const VIEW_PRESET_LABEL: Record<ViewPreset, string> = {
  iso: "Isometrica",
  front: "Frontal",
  back: "Posterior",
  left: "Izquierda",
  right: "Derecha",
  top: "Superior",
  bottom: "Inferior",
};

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
  /** which view (within the current sheet) arrow/outline tools apply to */
  activeViewId: string | null;
  arrowToolActive: boolean;

  addParts: (parts: Part[]) => void;
  clearParts: () => void;
  selectPart: (id: string | null) => void;
  setPartPose: (id: string, pose: Pose) => void;
  setPartColor: (id: string, color: string) => void;
  setPartVisible: (id: string, visible: boolean) => void;

  setViewPreset: (v: ViewPreset) => void;
  setRenderMode: (m: RenderMode) => void;

  setTab: (tab: "3d" | "2d") => void;

  createSheet: (name: string) => string;
  deleteSheet: (id: string) => void;
  setCurrentSheet: (id: string | null) => void;
  renameSheet: (id: string, name: string) => void;

  insertView: (sheetId: string, viewPreset: ViewPreset) => string;
  deleteView: (sheetId: string, viewId: string) => void;
  moveView: (sheetId: string, viewId: string, x: number, y: number) => void;
  resizeView: (
    sheetId: string,
    viewId: string,
    width: number,
    height: number
  ) => void;
  updateView: (
    sheetId: string,
    viewId: string,
    patch: Partial<Pick<ViewInstance, "viewPreset" | "renderMode" | "label">>
  ) => void;
  setActiveView: (viewId: string | null) => void;

  setViewPartState: (
    sheetId: string,
    viewId: string,
    partId: string,
    patch: Partial<PartStepState>
  ) => void;

  setArrowToolActive: (active: boolean) => void;
  addArrowToView: (
    sheetId: string,
    viewId: string,
    from: Vec3,
    to: Vec3,
    color?: string
  ) => void;
  deleteArrowFromView: (sheetId: string, viewId: string, arrowId: string) => void;
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  parts: {},
  partOrder: [],
  poses: {},
  selectedPartId: null,

  viewPreset: "iso",
  renderMode: "shaded",

  tab: "3d",

  sheets: {},
  sheetOrder: [],
  currentSheetId: null,
  activeViewId: null,
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

  setTab: (tab) => set({ tab }),

  createSheet: (name) => {
    const id = nextId("sheet");
    const sheet: Sheet = { id, name, views: [] };
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
      label: `Vista ${VIEW_PRESET_LABEL[viewPreset]} ${insertIndex + 1}`,
      x: 24 + insertIndex * VIEW_INSERT_OFFSET,
      y: 24 + insertIndex * VIEW_INSERT_OFFSET,
      width: DEFAULT_VIEW_SIZE.width,
      height: DEFAULT_VIEW_SIZE.height,
      viewPreset,
      renderMode: "shaded",
      partStates,
      arrows: [],
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

  resizeView: (sheetId, viewId, width, height) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId
          ? { ...v, width: Math.max(120, width), height: Math.max(90, height) }
          : v
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

  setArrowToolActive: (active) => set({ arrowToolActive: active }),

  addArrowToView: (sheetId, viewId, from, to, color = "#ff2d55") =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId
          ? {
              ...v,
              arrows: [
                ...v.arrows,
                { id: nextId("arrow"), from, to, color } as Arrow,
              ],
            }
          : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),

  deleteArrowFromView: (sheetId, viewId, arrowId) =>
    set((s) => {
      const sheet = s.sheets[sheetId];
      if (!sheet) return {};
      const views = sheet.views.map((v) =>
        v.id === viewId
          ? { ...v, arrows: v.arrows.filter((a) => a.id !== arrowId) }
          : v
      );
      return { sheets: { ...s.sheets, [sheetId]: { ...sheet, views } } };
    }),
}));
