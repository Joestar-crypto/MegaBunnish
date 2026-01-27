import { useConstellation } from '../state/constellation';
import { SpecialFilters } from '../types';
import { getCategoryColor } from '../utils/colors';

const MobileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x={7.5} y={3.5} width={9} height={17} rx={2} stroke="currentColor" strokeWidth={1.5} />
    <line x1={7.5} y1={7.5} x2={16.5} y2={7.5} stroke="currentColor" strokeWidth={1.5} opacity={0.5} />
    <circle cx={12} cy={17.5} r={0.9} fill="currentColor" />
  </svg>
);

type SpecialFilterKey = keyof SpecialFilters;

const formatCategoryLabel = (category: string) =>
  category === 'Prediction Market' ? 'Prediction M.' : category;

type SpecialFilterDefinition = {
  key: SpecialFilterKey;
  label: string;
  hint?: string;
  iconSrc?: string;
  Icon?: () => JSX.Element;
};

const SPECIAL_FILTERS: SpecialFilterDefinition[] = [
  { key: 'megamafia', label: 'Megamafia', iconSrc: '/logos/Megamafia.png' },
  { key: 'native', label: 'Native', hint: 'MegaETH core', iconSrc: '/logos/Megaeth.jpg' },
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
    if (category && activeCategory === category) {
      setActiveCategory(null);
      return;
    }
    setActiveCategory(category);
  };

  return (
    <div className={`filter-stack ${isInteracting ? 'filter-stack--hidden' : ''}`}>
      <div className="trait-menu" role="group" aria-label="Signal traits">
        {SPECIAL_FILTERS.map(({ key, label, hint, Icon, iconSrc }) => (
          <button
            key={key}
            type="button"
            className={filters[key] ? 'chip chip--trait active' : 'chip chip--trait'}
            onClick={() => toggleFilter(key)}
            aria-pressed={filters[key]}
          >
            <span className="chip__leading-icon">
              {iconSrc ? <img src={iconSrc} alt="" aria-hidden /> : Icon ? <Icon /> : null}
            </span>
            <span className="chip__stack">
              <span className="chip-label">{label}</span>
              {hint ? <span className="chip-hint">{hint}</span> : null}
            </span>
          </button>
        ))}
      </div>
      <aside className="category-rail" aria-label="Categories">
        <p className="category-rail__section-heading">Sectors</p>
        <div className="category-rail__list" role="tablist">
          <button
            className={activeCategory === null ? 'chip chip--category active' : 'chip chip--category'}
            type="button"
            onClick={() => quickSelect(null)}
            aria-pressed={activeCategory === null}
          >
            <span className="chip-label">All</span>
            <span className="chip-count">{totalProjects}</span>
          </button>
          {categories.map((category) => {
            const accent = getCategoryColor(category);
            const style =
              activeCategory === category
                ? { borderColor: accent, color: accent }
                : { borderColor: accent };
            return (
              <button
                key={category}
                className={activeCategory === category ? 'chip chip--category active' : 'chip chip--category'}
                type="button"
                style={style}
                onClick={() => quickSelect(category)}
                aria-pressed={activeCategory === category}
              >
                <span className="chip-label">{formatCategoryLabel(category)}</span>
                <span className="chip-count">{categoryCounts[category] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
