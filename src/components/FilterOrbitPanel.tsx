const FavoriteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 3.5 14.4 9l5.6.5-4.2 3.6 1.3 5.7L12 15.9l-5.1 2.9 1.3-5.7L4 9.5l5.6-.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.8}
      strokeLinejoin="round"
    />
  </svg>
);
import type { CSSProperties } from 'react';
import { useConstellation } from '../state/constellation';
import { SpecialFilters } from '../types';
import { getCategoryColor } from '../utils/colors';
import { JOJO_PROFILES } from '../data/jojoProfiles';

const MegamafiaIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M5 9.5 8.2 7l3.3 2.5L14.8 7 19 9.5l-1 9.5H6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
    <path d="M9.25 12.5 12 15.25 14.75 12.5" fill="none" stroke="currentColor" strokeWidth={1.4} />
  </svg>
);

const NativeCoreIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx={12} cy={12} r={7} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.8} />
    <circle cx={12} cy={12} r={3.2} fill="currentColor" opacity={0.75} />
    <circle cx={12} cy={12} r={1.4} fill="var(--page-bg)" />
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

const buildTraitClassName = (key: SpecialFilterKey, isActive: boolean) => {
  const classes = ['chip', 'chip--trait', `chip--trait-${key}`];
  if (isActive) {
    classes.push('active');
  }
  return classes.join(' ');
};

const SPECIAL_FILTER_ACTIVE_THEME: Partial<Record<SpecialFilterKey, { background: string; color: string }>> = {
  megamafia: { background: '#ffffff', color: '#111217' },
  jojo: { background: '#fff533', color: '#1f1f1f' },
  native: { background: '#e0d9d9', color: '#1a1a1a' }
};

type TraitStyleBundle = { button?: CSSProperties; icon?: CSSProperties };

const getTraitStyles = (key: SpecialFilterKey, isActive: boolean): TraitStyleBundle => {
  if (!isActive) {
    return { button: undefined, icon: undefined };
  }
  const theme = SPECIAL_FILTER_ACTIVE_THEME[key];
  if (!theme) {
    return { button: undefined, icon: undefined };
  }
  const iconBackground = key === 'jojo' ? 'rgba(31, 31, 31, 0.12)' : 'rgba(5, 6, 18, 0.15)';
  return {
    button: { backgroundColor: theme.background, color: theme.color },
    icon: { background: iconBackground, color: theme.color }
  };
};

const SPECIAL_FILTERS: SpecialFilterDefinition[] = [
  { key: 'megamafia', label: 'Megamafia', iconSrc: '/logos/Megamafia.webp', Icon: MegamafiaIcon },
  {
    key: 'jojo',
    label: "Jojo's Selection",
    hint: 'Personal farming list',
    iconSrc: '/logos/Jojo2.webp'
  },
  { key: 'native', label: 'MegaETH', hint: 'Core native', iconSrc: '/logos/MegaETH.webp', Icon: NativeCoreIcon }
];

type FilterOrbitPanelProps = {
  isInteracting?: boolean;
};

const ALL_CATEGORY_ACCENT = '#c8ccdd';
const ALL_CATEGORY_BORDER = 'rgba(200, 204, 221, 0.45)';
const NOISE_PROJECT_OFFSET = 1;

export const FilterOrbitPanel = ({ isInteracting = false }: FilterOrbitPanelProps) => {
  const {
    projectPoolSize,
    categories,
    categoryCounts,
    activeCategory,
    setActiveCategory,
    filters,
    jojoProfileId,
    setJojoProfile,
    toggleFilter,
    favoriteIds,
    favoritesOnly,
    toggleFavoritesOnly
  } = useConstellation();
  const totalProjects = projectPoolSize + NOISE_PROJECT_OFFSET;
  const hasFavorites = favoriteIds.length > 0;
  const favoritesDisabled = !favoritesOnly && !hasFavorites;
  const showJojoProfiles = filters.jojo && JOJO_PROFILES.length > 1;
  const quickSelect = (category: string | null) => {
    if (category && activeCategory === category) {
      setActiveCategory(null);
      return;
    }
    setActiveCategory(category);
  };

  return (
    <>
      <div
        className={`trait-dock ${isInteracting ? 'ui-panel--hidden' : ''} ${
          showJojoProfiles ? 'trait-dock--jojo-active' : ''
        }`}
      >
        <div className="trait-menu" role="group" aria-label="Signal traits">
          {SPECIAL_FILTERS.map(({ key, label, hint, Icon, iconSrc }) => {
            const traitStyles = getTraitStyles(key, filters[key]);
            return (
              <button
                key={key}
                type="button"
                className={buildTraitClassName(key, filters[key])}
                onClick={() => toggleFilter(key)}
                aria-pressed={filters[key]}
                style={traitStyles.button}
              >
                <span className="chip__leading-icon" style={traitStyles.icon}>
                  {iconSrc ? <img src={iconSrc} alt="" aria-hidden /> : Icon ? <Icon /> : null}
                </span>
                <span className="chip__stack">
                  <span className="chip-label">{label}</span>
                  {hint ? <span className="chip-hint">{hint}</span> : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={favoritesOnly ? 'chip chip--trait chip--favorites active' : 'chip chip--trait chip--favorites'}
            onClick={toggleFavoritesOnly}
            aria-pressed={favoritesOnly}
            disabled={favoritesDisabled}
            title="To add favorites, open a project and tap the star in its details."
            style={
              favoritesOnly
                ? { backgroundColor: '#ffd84d', borderColor: '#ffd84d', color: '#05060f' }
                : undefined
            }
          >
            <span className="chip__leading-icon">
              <FavoriteIcon />
            </span>
            <span className="chip__stack">
              <span className="chip-label">Favorites</span>
              <span className="chip-hint">{hasFavorites ? `${favoriteIds.length} saved` : 'Add stars'}</span>
            </span>
          </button>
        </div>
          {showJojoProfiles ? (
            <div className="jojo-profile-menu" role="group" aria-label="Profile options">
              <div className="jojo-profile-menu__header">
                <span>Profile</span>
              </div>
              <div className="jojo-profile-menu__options">
                {JOJO_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={
                      profile.id === jojoProfileId ? 'jojo-profile-button active' : 'jojo-profile-button'
                    }
                    onClick={() => setJojoProfile(profile.id)}
                    aria-pressed={profile.id === jojoProfileId}
                  >
                    <span className="jojo-profile-button__label">{profile.label}</span>
                    {profile.hint ? <span className="jojo-profile-button__hint">{profile.hint}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
      </div>
      <div className={`category-dock ${isInteracting ? 'ui-panel--hidden' : ''}`}>
        <aside className="category-rail" aria-label="Categories">
          <p className="category-rail__section-heading">Sectors</p>
          <div className="category-rail__list" role="tablist">
            <button
              className={activeCategory === null ? 'chip chip--category active' : 'chip chip--category'}
              type="button"
              style={
                activeCategory === null
                  ? {
                      borderColor: ALL_CATEGORY_ACCENT,
                      backgroundColor: ALL_CATEGORY_ACCENT,
                      color: '#05060f'
                    }
                  : {
                      borderColor: ALL_CATEGORY_BORDER,
                      backgroundColor: 'transparent',
                      color: ALL_CATEGORY_ACCENT
                    }
              }
              onClick={() => quickSelect(null)}
              aria-pressed={activeCategory === null}
              title="Also reveals the distant Noise signal"
            >
              <span className="chip-label">All</span>
              <span
                className="chip-count"
                style={
                  activeCategory === null
                    ? { color: '#05060f' }
                    : { color: 'rgba(200, 204, 221, 0.9)' }
                }
              >
                {totalProjects}
              </span>
            </button>
            {categories.map((category) => {
              const accent = getCategoryColor(category);
              const isActive = activeCategory === category;
              const style = isActive
                ? { borderColor: accent, backgroundColor: accent, color: '#05060f' }
                : { borderColor: accent, backgroundColor: 'transparent' };
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
                  <span className="chip-count" style={isActive ? { color: '#05060f' } : undefined}>
                    {categoryCounts[category] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </>
  );
};
