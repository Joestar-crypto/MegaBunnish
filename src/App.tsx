import { useCallback, useState } from 'react';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider, useConstellation } from './state/constellation';

const AppContent = () => {
  const [isInteracting, setIsInteracting] = useState(false);
  const { resetCamera } = useConstellation();

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
            <a
              className="hero-overlay__credit"
              href="https://x.com/JoestarCrypto"
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="hero-overlay__credit-label">Made by Joestar</span>
              <span className="hero-overlay__credit-avatar" aria-hidden="true">
                <img src="/logos/Jojo2.webp" alt="" />
              </span>
            </a>
          </div>
        </div>
        <FilterOrbitPanel isInteracting={isInteracting} />
        <button type="button" className="reset-anchor" onClick={resetCamera} aria-label="Reset camera view">
          Reset
        </button>
        <ProjectDetailDrawer />
      </div>
      <div className="mobile-overlay">
        Please visit the site on desktop for the best experience.
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
