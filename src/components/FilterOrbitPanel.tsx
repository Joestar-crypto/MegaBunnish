import { useConstellation } from '../state/constellation';

export const FilterOrbitPanel = () => {
  const { projects, categories, categoryCounts, activeCategory, setActiveCategory, resetCamera } = useConstellation();
  const totalProjects = projects.length;

  return (
    <aside className="filter-panel">
      <header className="filter-hero">
        <div>
          <p className="eyebrow">MegaBunnish mission control</p>
          <h2>Cluster autopilot</h2>
          <p className="hero-lede">
            Rocket keeps every curated primitive, NFT drop lane, and Depin corridor aligned inside this panel.
          </p>
        </div>
        <img
          src="/logos/Rocket.svg"
          alt="Rocket sensor"
          className="filter-hero__rocket"
          loading="lazy"
        />
      </header>
      <div className="chips">
        <button
          className={activeCategory === null ? 'chip active' : 'chip'}
          type="button"
          onClick={() => {
            setActiveCategory(null);
            resetCamera();
          }}
        >
          <span className="chip-label">All</span>
          <span className="chip-count">{totalProjects}</span>
        </button>
        {categories.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? 'chip active' : 'chip'}
            type="button"
            onClick={() => setActiveCategory(category)}
          >
            <span className="chip-label">{category}</span>
            <span className="chip-count">{categoryCounts[category] ?? 0}</span>
          </button>
        ))}
      </div>
      <section className="hint-block">
        <p>Left-click and drag to glide; zoom via browser controls for surgical focus.</p>
        <p>Each chip recenters on its curated cluster without the extra noise.</p>
      </section>
    </aside>
  );
};
