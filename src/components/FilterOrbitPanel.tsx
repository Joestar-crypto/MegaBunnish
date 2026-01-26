import { useConstellation } from '../state/constellation';

type FilterOrbitPanelProps = {
  isInteracting?: boolean;
};

export const FilterOrbitPanel = ({ isInteracting = false }: FilterOrbitPanelProps) => {
  const {
    projects,
    categories,
    categoryCounts,
    activeCategory,
    setActiveCategory,
    resetCamera,
    filters,
    toggleFilter
  } = useConstellation();
  const totalProjects = projects.length;

  const quickSelect = (category: string | null) => {
    if (category === null) {
      setActiveCategory(null);
      resetCamera();
      return;
    }
    setActiveCategory(category);
  };

  const overlayFilters: { key: keyof typeof filters; label: string }[] = [
    { key: 'megamafia', label: 'Megamafia' },
    { key: 'mobile', label: 'Mobile' }
  ];

  return (
    <aside
      className={`category-rail ${isInteracting ? 'category-rail--hidden' : ''}`}
      aria-label="Constellation filters"
    >
      <div className="category-rail__special">
        {overlayFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={filters[filter.key] ? 'chip active' : 'chip'}
            onClick={() => toggleFilter(filter.key)}
          >
            <span className="chip-label">{filter.label}</span>
          </button>
        ))}
      </div>
      <div className="category-rail__divider" aria-hidden />
      <div className="category-rail__list" role="tablist">
        <button
          className={activeCategory === null ? 'chip active' : 'chip'}
          type="button"
          onClick={() => quickSelect(null)}
        >
          <span className="chip-label">All</span>
          <span className="chip-count">{totalProjects}</span>
        </button>
        {categories.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? 'chip active' : 'chip'}
            type="button"
            onClick={() => quickSelect(category)}
          >
            <span className="chip-label">{category}</span>
            <span className="chip-count">{categoryCounts[category] ?? 0}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};
