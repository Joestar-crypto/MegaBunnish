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
          <p className="eyebrow">Astral ecosystems</p>
          <h1>Navigate the application field</h1>
          <p className="muted">
            Filter by primitive, glide through the map, and dive into live documentation and incentive intel without leaving the canvas.
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
