import Viewport from "./scene/Viewport";
import Toolbar from "./components/Toolbar";
import PartsPanel from "./components/PartsPanel";
import DrawingCanvas from "./components/DrawingCanvas";
import ViewInspector from "./components/ViewInspector";
import { useAssemblyStore } from "./assembly/store";

export default function App() {
  const tab = useAssemblyStore((s) => s.tab);

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <aside className="w-72 flex flex-col border-r border-neutral-800 bg-neutral-900">
          {/* Both panels stay mounted so switching tabs never tears down
              the three.js scene/WebGL context (which was wiping the 3D
              view and breaking navigation on return). */}
          <div className={tab === "3d" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
              Piezas
            </h2>
            <PartsPanel />
          </div>
          <div className={tab === "2d" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
              Vista seleccionada
            </h2>
            <ViewInspector />
          </div>
        </aside>
        <main className="flex-1 min-w-0 relative">
          <div className={tab === "3d" ? "absolute inset-0" : "hidden"}>
            <Viewport />
          </div>
          <div className={tab === "2d" ? "absolute inset-0" : "hidden"}>
            <DrawingCanvas />
          </div>
        </main>
      </div>
    </div>
  );
}
