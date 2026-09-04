import Viewport from "./scene/Viewport";
import Toolbar from "./components/Toolbar";
import PartsPanel from "./components/PartsPanel";
import PlansPanel from "./components/PlansPanel";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <aside className="w-72 flex flex-col border-r border-neutral-800 bg-neutral-900">
          <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
            Piezas
          </h2>
          <PartsPanel />
          <h2 className="px-3 pt-2 text-xs uppercase tracking-wide text-neutral-500">
            Planos / Guia paso a paso
          </h2>
          <PlansPanel />
        </aside>
        <main className="flex-1 min-w-0">
          <Viewport />
        </main>
      </div>
    </div>
  );
}
