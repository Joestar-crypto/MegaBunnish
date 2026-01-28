import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const FavoriteIcon = () => (_jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: _jsx("path", { d: "M12 3.5 14.4 9l5.6.5-4.2 3.6 1.3 5.7L12 15.9l-5.1 2.9 1.3-5.7L4 9.5l5.6-.5Z", fill: "currentColor", stroke: "currentColor", strokeWidth: 0.8, strokeLinejoin: "round" }) }));
import { useConstellation } from '../state/constellation';
import { getCategoryColor } from '../utils/colors';
const MegamafiaIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("path", { d: "M5 9.5 8.2 7l3.3 2.5L14.8 7 19 9.5l-1 9.5H6Z", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" }), _jsx("path", { d: "M9.25 12.5 12 15.25 14.75 12.5", fill: "none", stroke: "currentColor", strokeWidth: 1.4 })] }));
const NativeCoreIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("circle", { cx: 12, cy: 12, r: 7, fill: "none", stroke: "currentColor", strokeWidth: 1.4, opacity: 0.8 }), _jsx("circle", { cx: 12, cy: 12, r: 3.2, fill: "currentColor", opacity: 0.75 }), _jsx("circle", { cx: 12, cy: 12, r: 1.4, fill: "var(--page-bg)" })] }));
const formatCategoryLabel = (category) => category === 'Prediction Market' ? 'Prediction M.' : category;
const SPECIAL_FILTERS = [
    { key: 'megamafia', label: 'Megamafia', iconSrc: '/logos/Megamafia.webp', Icon: MegamafiaIcon },
    { key: 'native', label: 'MegaETH', hint: 'Core native', iconSrc: '/logos/MegaETH.webp', Icon: NativeCoreIcon }
];
const ALL_CATEGORY_ACCENT = '#c8ccdd';
const ALL_CATEGORY_BORDER = 'rgba(200, 204, 221, 0.45)';
export const FilterOrbitPanel = ({ isInteracting = false }) => {
    const { projectPoolSize, categories, categoryCounts, activeCategory, setActiveCategory, filters, toggleFilter, favoriteIds, favoritesOnly, toggleFavoritesOnly } = useConstellation();
    const totalProjects = projectPoolSize;
    const hasFavorites = favoriteIds.length > 0;
    const favoritesDisabled = !favoritesOnly && !hasFavorites;
    const quickSelect = (category) => {
        if (category && activeCategory === category) {
            setActiveCategory(null);
            return;
        }
        setActiveCategory(category);
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `trait-dock ${isInteracting ? 'ui-panel--hidden' : ''}`, children: _jsxs("div", { className: "trait-menu", role: "group", "aria-label": "Signal traits", children: [SPECIAL_FILTERS.map(({ key, label, hint, Icon, iconSrc }) => (_jsxs("button", { type: "button", className: filters[key] ? 'chip chip--trait active' : 'chip chip--trait', onClick: () => toggleFilter(key), "aria-pressed": filters[key], children: [_jsx("span", { className: "chip__leading-icon", children: iconSrc ? _jsx("img", { src: iconSrc, alt: "", "aria-hidden": true }) : Icon ? _jsx(Icon, {}) : null }), _jsxs("span", { className: "chip__stack", children: [_jsx("span", { className: "chip-label", children: label }), hint ? _jsx("span", { className: "chip-hint", children: hint }) : null] })] }, key))), _jsxs("button", { type: "button", className: favoritesOnly ? 'chip chip--trait chip--favorites active' : 'chip chip--trait chip--favorites', onClick: toggleFavoritesOnly, "aria-pressed": favoritesOnly, disabled: favoritesDisabled, title: "To add favorites, open a project and tap the star in its details.", children: [_jsx("span", { className: "chip__leading-icon", children: _jsx(FavoriteIcon, {}) }), _jsxs("span", { className: "chip__stack", children: [_jsx("span", { className: "chip-label", children: "Favorites" }), _jsx("span", { className: "chip-hint", children: hasFavorites ? `${favoriteIds.length} saved` : 'Add stars' })] })] })] }) }), _jsx("div", { className: `category-dock ${isInteracting ? 'ui-panel--hidden' : ''}`, children: _jsxs("aside", { className: "category-rail", "aria-label": "Categories", children: [_jsx("p", { className: "category-rail__section-heading", children: "Sectors" }), _jsxs("div", { className: "category-rail__list", role: "tablist", children: [_jsxs("button", { className: activeCategory === null ? 'chip chip--category active' : 'chip chip--category', type: "button", style: activeCategory === null
                                        ? {
                                            borderColor: ALL_CATEGORY_ACCENT,
                                            backgroundColor: ALL_CATEGORY_ACCENT,
                                            color: '#05060f'
                                        }
                                        : {
                                            borderColor: ALL_CATEGORY_BORDER,
                                            backgroundColor: 'transparent',
                                            color: 'rgba(200, 204, 221, 0.9)'
                                        }, onClick: () => quickSelect(null), "aria-pressed": activeCategory === null, children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", style: activeCategory === null
                                                ? { color: '#05060f' }
                                                : { color: 'rgba(200, 204, 221, 0.9)' }, children: totalProjects })] }), categories.map((category) => {
                                    const accent = getCategoryColor(category);
                                    const isActive = activeCategory === category;
                                    const style = isActive
                                        ? { borderColor: accent, backgroundColor: accent, color: '#05060f' }
                                        : { borderColor: accent, backgroundColor: 'transparent' };
                                    return (_jsxs("button", { className: activeCategory === category ? 'chip chip--category active' : 'chip chip--category', type: "button", style: style, onClick: () => quickSelect(category), "aria-pressed": activeCategory === category, children: [_jsx("span", { className: "chip-label", children: formatCategoryLabel(category) }), _jsx("span", { className: "chip-count", style: isActive ? { color: '#05060f' } : undefined, children: categoryCounts[category] ?? 0 })] }, category));
                                })] })] }) })] }));
};
