import { useCallback, useState } from 'react';
import { CameraControls } from './components/CameraControls';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider } from './state/constellation';

const AppContent = () => {
  const [isInteracting, setIsInteracting] = useState(false);

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);
  }, []);

  return (
    <div className="app-shell app-shell--immersive">
      <div className="immersive-stage">
        <div className="immersive-stage__background">
          <ConstellationCanvas
            onInteractionStart={handleInteractionStart}
            onInteractionEnd={handleInteractionEnd}
          />
        </div>
        <div className={`hero-overlay ${isInteracting ? 'hero-overlay--hidden' : ''}`}>
          <div className="hero-overlay__content">
            <p className="eyebrow">MegaETH ecosystem</p>
            <h1>MegaBunnish</h1>
          </div>
        </div>
        <FilterOrbitPanel isInteracting={isInteracting} />
        <CameraControls isHidden={isInteracting} />
        <ProjectDetailDrawer />
      </div>
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
