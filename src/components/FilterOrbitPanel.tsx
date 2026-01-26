import { useConstellation } from '../state/constellation';

export const FilterOrbitPanel = () => {
  const { projects, categories, categoryCounts, activeCategory, setActiveCategory, resetCamera } = useConstellation();
  const totalProjects = projects.length;

  return (
    <aside className="filter-panel">
      <header>
        <p className="eyebrow">Navigate</p>
        <h2>Choose your sector</h2>
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
        <p>Right-click and drag anywhere inside the constellation to glide through space.</p>
        <p>Scroll to zoom via browser controls for even more focus.</p>
      </section>
    </aside>
  );
};
