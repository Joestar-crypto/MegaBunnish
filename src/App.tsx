import { useCallback, useState } from 'react';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { WalletChecker } from './components/WalletChecker';
import { ConstellationHUD } from './components/ConstellationHUD';
import { KpiDashboard } from './components/KpiDashboard';
import { ConstellationProvider, useConstellation } from './state/constellation';

const AppContent = () => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const { resetCamera, filters } = useConstellation();
  const showJojoBanner = filters.jojo;

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);
  }, []);

  const openDashboards = useCallback(() => {
    setIsDashboardOpen(true);
  }, []);

  const closeDashboards = useCallback(() => {
    setIsDashboardOpen(false);
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
            <h1 className="hero-overlay__title">
              <img src="/logos/MegaBunnish3.png" alt="MegaBunnish" />
            </h1>
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
        <div className={`constellation-hud ${isInteracting ? 'ui-panel--hidden' : ''}`}>
          <ConstellationHUD onOpenDashboards={openDashboards} />
        </div>
        <button type="button" className="reset-anchor" onClick={resetCamera} aria-label="Reset camera view">
          Reset
        </button>
        {showJojoBanner ? (
          <div
            className={`jojo-banner ${isInteracting ? 'jojo-banner--hidden' : ''}`}
            role="note"
            aria-live="polite"
          >
            <p>
              This is my purely personal farming list with teams I trust, projects that will most likely launch a token,
              and apps I'll use organically.
              <br />
              Being outside this list doesn't mean it's not worth it, I had to make hard choices for this one
            </p>
          </div>
        ) : null}
        <ProjectDetailDrawer />
        <WalletChecker />
        <KpiDashboard isOpen={isDashboardOpen} onClose={closeDashboards} />
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
