import { useMemo } from 'react';
import { useConstellation } from '../state/constellation';

export const ConstellationHUD = () => {
  const { projects } = useConstellation();

  const stats = useMemo(() => {
    const incentives = projects.flatMap((project) => project.incentives);
    return {
      totalProjects: projects.length,
      activeIncentives: incentives.length
    };
  }, [projects]);

  return (
    <div className="hud-card">
      <p className="eyebrow">Constellation</p>
      <h3>{stats.totalProjects} active orbs</h3>
      <p className="muted">{stats.activeIncentives} live incentives glowing right now.</p>
      <div className="hud-actions">
        <span>Right-click drag to explore</span>
        <span>Click nodes for intel</span>
      </div>
    </div>
  );
};
