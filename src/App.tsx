import { useCallback, useState } from 'react';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { KpiDashboard } from './components/KpiDashboard';
import { EthosTrustScores } from './components/EthosTrustScores';
import { AiAdvisorChat } from './components/AiAdvisorChat';
import { Globe3DView } from './components/Globe3DView';
import { ConstellationProvider, useConstellation } from './state/constellation';

const AppContent = () => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  // EXPERIMENTAL 3D mode toggle. Remove with the Globe3DView feature.
  const [is3D, setIs3D] = useState(false);
  const { resetCamera, filters } = useConstellation();
  const showJojoBanner = filters.jojo;

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);
  }, []);

  const closeDashboards = useCallback(() => {
    setIsDashboardOpen(false);
  }, []);

  return (
    <div className="app-shell app-shell--immersive">
      <div className="immersive-stage">
        <div className="immersive-stage__canvas">
          <div className="immersive-stage__background">
            {is3D ? (
              <Globe3DView
                onInteractionStart={handleInteractionStart}
                onInteractionEnd={handleInteractionEnd}
              />
            ) : (
              <ConstellationCanvas
                onInteractionStart={handleInteractionStart}
                onInteractionEnd={handleInteractionEnd}
              />
            )}
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
              <a
                className="hero-overlay__docs-link"
                href="/docs/index.html"
                target="_blank"
                rel="noreferrer noopener"
              >
                Docs &amp; API
              </a>
            </div>
          </div>
          <button
            type="button"
            className={`reset-anchor ${isInteracting ? 'ui-panel--hidden' : ''}`}
            onClick={resetCamera}
            aria-label="Reset camera view"
          >
            Reset
          </button>
          {/* EXPERIMENTAL 3D toggle — remove with the Globe3DView feature. */}
          <button
            type="button"
            className={`view-mode-toggle ${isInteracting ? 'ui-panel--hidden' : ''} ${is3D ? 'is-active' : ''}`}
            onClick={() => setIs3D((v) => !v)}
            aria-pressed={is3D}
            aria-label={is3D ? 'Switch to 2D constellation' : 'Switch to 3D globes'}
          >
            {is3D ? '2D' : '3D'}
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
          <div className="hud-stack">
            <EthosTrustScores isInteracting={isInteracting} />
            <AiAdvisorChat isInteracting={isInteracting} />
          </div>
        </div>
        <div className="immersive-stage__rail">
          <FilterOrbitPanel isInteracting={isInteracting} />
        </div>
      </div>
      <KpiDashboard isOpen={isDashboardOpen} onClose={closeDashboards} />
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
