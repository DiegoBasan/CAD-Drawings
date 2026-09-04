import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAssemblyStore } from "../assembly/store";
import DrawingViewBox from "../scene/DrawingViewBox";
import { paperSizePx } from "../scene/paper";
import { VIEW_PRESET_LABEL } from "../scene/viewPresets";
import ViewPresetIcon from "./ViewPresetIcon";
import type { PaperSize, ViewPreset } from "../types/domain";

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "A2", "A1"];

const INSERT_PRESETS: ViewPreset[] = [
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

export default function DrawingCanvas() {
  const sheetOrder = useAssemblyStore((s) => s.sheetOrder);
  const sheets = useAssemblyStore((s) => s.sheets);
  const currentSheetId = useAssemblyStore((s) => s.currentSheetId);
  const createSheet = useAssemblyStore((s) => s.createSheet);
  const deleteSheet = useAssemblyStore((s) => s.deleteSheet);
  const setCurrentSheet = useAssemblyStore((s) => s.setCurrentSheet);
  const setSheetPaperSize = useAssemblyStore((s) => s.setSheetPaperSize);
  const insertView = useAssemblyStore((s) => s.insertView);
  const activeViewId = useAssemblyStore((s) => s.activeViewId);
  const setActiveView = useAssemblyStore((s) => s.setActiveView);
  const partOrder = useAssemblyStore((s) => s.partOrder);

  const [sheetCount, setSheetCount] = useState(0);
  const [newPaperSize, setNewPaperSize] = useState<PaperSize>("A3");
  const [view2d, setView2d] = useState({ zoom: 0.5, panX: 40, panY: 40 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const sheet = currentSheetId ? sheets[currentSheetId] : null;

  function handleNewSheet() {
    const n = sheetCount + 1;
    setSheetCount(n);
    createSheet(`Hoja ${n}`, newPaperSize);
  }

  // React attaches onWheel as a passive listener, so preventDefault() there
  // silently no-ops and the page scrolls underneath our zoom. Attach a real
  // non-passive listener instead.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: globalThis.WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setView2d((prev) => {
        const factor = Math.exp(-e.deltaY * 0.001);
        const zoom = Math.min(4, Math.max(0.05, prev.zoom * factor));
        const worldX = (cursorX - prev.panX) / prev.zoom;
        const worldY = (cursorY - prev.panY) / prev.zoom;
        return {
          zoom,
          panX: cursorX - worldX * zoom,
          panY: cursorY - worldY * zoom,
        };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button === 2) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const originX = view2d.panX;
      const originY = view2d.panY;
      function onMove(ev: PointerEvent) {
        setView2d((prev) => ({
          ...prev,
          panX: originX + (ev.clientX - startX),
          panY: originY + (ev.clientY - startY),
        }));
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    } else if (e.target === e.currentTarget) {
      setActiveView(null);
    }
  }

  const paperPx = sheet ? paperSizePx(sheet.paperSize) : { width: 0, height: 0 };

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
              {sheets[id].name} ({sheets[id].paperSize})
            </button>
          ))}
        </div>

        <select
          className="bg-neutral-800 text-xs rounded px-1 py-1"
          value={newPaperSize}
          onChange={(e) => setNewPaperSize(e.target.value as PaperSize)}
        >
          {PAPER_SIZES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          className="px-2 py-1 rounded text-xs bg-emerald-700 hover:bg-emerald-600"
          onClick={handleNewSheet}
        >
          + Nuevo canvas
        </button>
        {currentSheetId && (
          <>
            <select
              className="bg-neutral-800 text-xs rounded px-1 py-1"
              value={sheets[currentSheetId].paperSize}
              onChange={(e) =>
                setSheetPaperSize(currentSheetId, e.target.value as PaperSize)
              }
              title="Cambiar tamaño de hoja"
            >
              {PAPER_SIZES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300"
              onClick={() => deleteSheet(currentSheetId)}
            >
              eliminar hoja
            </button>
          </>
        )}

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
                  key={p}
                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700"
                  onClick={() => insertView(sheet.id, p)}
                  title={`Insertar vista: ${VIEW_PRESET_LABEL[p]}`}
                >
                  <ViewPresetIcon preset={p} />
                </button>
              ))
            )}
          </>
        )}
      </div>

      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-hidden bg-neutral-950 relative"
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!sheet ? (
          <div className="p-8 text-neutral-500 text-sm">
            Crea un canvas ("+ Nuevo canvas") para empezar a insertar vistas
            del ensamble.
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${view2d.panX}px, ${view2d.panY}px) scale(${view2d.zoom})`,
              transformOrigin: "0 0",
              width: paperPx.width,
              height: paperPx.height,
            }}
          >
            <div
              className="relative bg-white shadow-lg"
              style={{ width: paperPx.width, height: paperPx.height }}
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
          </div>
        )}
      </div>
    </div>
  );
}
