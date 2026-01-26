import { ConstellationCanvas } from './components/ConstellationCanvas';
import { ConstellationHUD } from './components/ConstellationHUD';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider } from './state/constellation';

const AppContent = () => {
  return (
    <div className="app-shell">
      <header className="site-heading">
        <div>
          <p className="eyebrow">MegaBunnish ecosystems</p>
          <h1>Command the MegaBunnish field</h1>
          <p className="muted">
            The ops board keeps every primitive, live documentation link, and incentive ping inside a single viewport.
          </p>
        </div>
      </header>
      <main className="constellation-grid">
        <FilterOrbitPanel />
        <section className="canvas-stage">
          <ConstellationCanvas />
          <ConstellationHUD />
          <ProjectDetailDrawer />
        </section>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <ConstellationProvider>
      <AppContent />
    </ConstellationProvider>
  );
};

export default App;
