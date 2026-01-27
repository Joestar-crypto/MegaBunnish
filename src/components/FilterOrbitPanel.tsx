import { useConstellation } from '../state/constellation';
import { SpecialFilters } from '../types';

const MegamafiaIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 9h16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
    <path
      d="M7 11h10l-1 5a4 4 0 0 1-8 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <circle cx={9.5} cy={15} r={1} fill="currentColor" />
    <circle cx={14.5} cy={15} r={1} fill="currentColor" />
  </svg>
);

const MobileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x={7.5} y={3.5} width={9} height={17} rx={2} stroke="currentColor" strokeWidth={1.5} />
    <line x1={7.5} y1={7.5} x2={16.5} y2={7.5} stroke="currentColor" strokeWidth={1.5} opacity={0.5} />
    <circle cx={12} cy={17.5} r={0.9} fill="currentColor" />
  </svg>
);

type SpecialFilterKey = keyof SpecialFilters;

const SPECIAL_FILTERS: Array<{
  key: SpecialFilterKey;
  label: string;
  hint?: string;
  Icon: () => JSX.Element;
}> = [
  { key: 'megamafia', label: 'Megamafia', Icon: MegamafiaIcon },
  { key: 'mobile', label: 'Mobile', hint: 'Phone-native', Icon: MobileIcon }
];

type FilterOrbitPanelProps = {
  isInteracting?: boolean;
};

export const FilterOrbitPanel = ({ isInteracting = false }: FilterOrbitPanelProps) => {
  const {
    projectPoolSize,
    categories,
    categoryCounts,
    activeCategory,
    setActiveCategory,
    filters,
    toggleFilter
  } = useConstellation();
  const totalProjects = projectPoolSize;

  const quickSelect = (category: string | null) => {
    setActiveCategory(category);
  };

  return (
    <aside
      className={`category-rail ${isInteracting ? 'category-rail--hidden' : ''}`}
      aria-label="Constellation filters"
    >
      <section className="category-rail__section" aria-label="Special traits">
        <p className="category-rail__section-heading">Signal traits</p>
        <div className="category-rail__special-grid">
          {SPECIAL_FILTERS.map(({ key, label, hint, Icon }) => (
            <button
              key={key}
              type="button"
              className={filters[key] ? 'chip chip--trait active' : 'chip chip--trait'}
              onClick={() => toggleFilter(key)}
              aria-pressed={filters[key]}
            >
              <span className="chip__leading-icon">
                <Icon />
              </span>
              <span className="chip__stack">
                <span className="chip-label">{label}</span>
                {hint ? <span className="chip-hint">{hint}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="category-rail__section" aria-label="Categories">
        <p className="category-rail__section-heading">Sectors</p>
        <div className="category-rail__list" role="tablist">
          <button
            className={activeCategory === null ? 'chip active' : 'chip'}
            type="button"
            onClick={() => quickSelect(null)}
            aria-pressed={activeCategory === null}
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
              aria-pressed={activeCategory === category}
            >
              <span className="chip-label">{category}</span>
              <span className="chip-count">{categoryCounts[category] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
};
