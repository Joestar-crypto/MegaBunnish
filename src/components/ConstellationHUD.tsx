import { useMemo, type CSSProperties } from 'react';
import { useConstellation } from '../state/constellation';

const ethosToneForScore = (score: number) => {
  if (!Number.isFinite(score)) {
    return 'ethos-pill--tone-default';
  }
  if (score < 800) {
    return 'ethos-pill--tone-untrusted';
  }
  if (score < 1200) {
    return 'ethos-pill--tone-questionable';
  }
  if (score < 1400) {
    return 'ethos-pill--tone-neutral';
  }
  if (score < 1600) {
    return 'ethos-pill--tone-known';
  }
  if (score < 1800) {
    return 'ethos-pill--tone-established';
  }
  if (score < 2000) {
    return 'ethos-pill--tone-renowned';
  }
  return 'ethos-pill--tone-renowned';
};

const ethosStyleForScore = (score: number): CSSProperties | undefined => {
  if (!Number.isFinite(score)) {
    return undefined;
  }
  if (score < 800) {
    return { backgroundColor: '#c40018', borderColor: '#ff4d68', color: '#fff4f4' };
  }
  if (score < 1200) {
    return { backgroundColor: '#e49700', borderColor: '#ffbd3a', color: '#2b1600' };
  }
  if (score < 1400) {
    return { backgroundColor: '#f8f7f0', borderColor: '#ffffff', color: '#1a1f2d' };
  }
  if (score < 1600) {
    return { backgroundColor: '#9bb4e6', borderColor: '#c5d7ff', color: '#05102a' };
  }
  if (score < 1800) {
    return { backgroundColor: '#2d85d3', borderColor: '#64b4ff', color: '#f1f8ff' };
  }
  return { backgroundColor: '#1b3474', borderColor: '#4e6fd1', color: '#e5edff' };
};

export const ConstellationHUD = () => {
  const { projects, ethosScores, resolveProjectById, ethosScoreThreshold } = useConstellation();

  const stats = useMemo(() => {
    const incentives = projects.flatMap((project) => project.incentives);
    return {
      totalProjects: projects.length,
      activeIncentives: incentives.length
    };
  }, [projects]);

  const scoreFormatter = useMemo(() => new Intl.NumberFormat('fr-FR'), []);

  const ethosHighlights = useMemo(() => {
    const entries = Object.entries(ethosScores);
    if (!entries.length) {
      return [];
    }
    const filteredEntries = entries.filter(([, score]) =>
      ethosScoreThreshold === null ? true : score >= ethosScoreThreshold
    );
    if (!filteredEntries.length) {
      return [];
    }
    return filteredEntries
      .map(([projectId, score]) => {
        const project = resolveProjectById(projectId);
        if (!project) {
          return null;
        }
        return { projectId, name: project.name, score };
      })
        .filter((entry): entry is { projectId: string; name: string; score: number } => entry !== null)
        .sort((a, b) => b.score - a.score);
  }, [ethosScores, resolveProjectById, ethosScoreThreshold]);

  const ethosPanel = useMemo(() => {
    if (!ethosHighlights.length) {
      return null;
    }
    return (
      <div className="ethos-pill-panel" aria-live="polite">
        <div className="ethos-pill-panel__header">
          <img src="/logos/Ethos.webp" alt="" aria-hidden="true" />
          <span>Ethos trust</span>
        </div>
        <div className="ethos-pill-panel__grid">
          {ethosHighlights.map((entry) => (
            <span
              key={entry.projectId}
              className={`ethos-pill ${ethosToneForScore(entry.score)}`}
              style={ethosStyleForScore(entry.score)}
            >
              <span className="ethos-pill__label">{entry.name}</span>
              <span className="ethos-pill__score">{scoreFormatter.format(entry.score)}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }, [ethosHighlights, scoreFormatter]);

  return (
    <div className="hud-card">
      <p className="eyebrow">Constellation</p>
      <h3>{stats.totalProjects} active orbs</h3>
      <p className="muted">{stats.activeIncentives} live incentives glowing left now.</p>
      <div className="hud-actions">
        <span>Left-click drag to explore</span>
        <span>Click nodes for intel</span>
        <span>Scroll or pinch to zoom</span>
      </div>
      {ethosPanel}
    </div>
  );
};
