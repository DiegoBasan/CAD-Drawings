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
          {tab === "3d" ? (
            <>
              <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
                Piezas
              </h2>
              <PartsPanel />
            </>
          ) : (
            <>
              <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
                Vista seleccionada
              </h2>
              <ViewInspector />
            </>
          )}
        </aside>
        <main className="flex-1 min-w-0">
          {tab === "3d" ? <Viewport /> : <DrawingCanvas />}
        </main>
      </div>
    </div>
  );
}
