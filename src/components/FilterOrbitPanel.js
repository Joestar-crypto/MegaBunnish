import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
import { getCategoryColor } from '../utils/colors';
const MobileIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("rect", { x: 7.5, y: 3.5, width: 9, height: 17, rx: 2, stroke: "currentColor", strokeWidth: 1.5 }), _jsx("line", { x1: 7.5, y1: 7.5, x2: 16.5, y2: 7.5, stroke: "currentColor", strokeWidth: 1.5, opacity: 0.5 }), _jsx("circle", { cx: 12, cy: 17.5, r: 0.9, fill: "currentColor" })] }));
const MegamafiaIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("path", { d: "M5 9.5 8.2 7l3.3 2.5L14.8 7 19 9.5l-1 9.5H6Z", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" }), _jsx("path", { d: "M9.25 12.5 12 15.25 14.75 12.5", fill: "none", stroke: "currentColor", strokeWidth: 1.4 })] }));
const NativeCoreIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("circle", { cx: 12, cy: 12, r: 7, fill: "none", stroke: "currentColor", strokeWidth: 1.4, opacity: 0.8 }), _jsx("circle", { cx: 12, cy: 12, r: 3.2, fill: "currentColor", opacity: 0.75 }), _jsx("circle", { cx: 12, cy: 12, r: 1.4, fill: "var(--page-bg)" })] }));
const formatCategoryLabel = (category) => category === 'Prediction Market' ? 'Prediction M.' : category;
const SPECIAL_FILTERS = [
    { key: 'megamafia', label: 'Megamafia', iconSrc: '/logos/Megamafia.webp', Icon: MegamafiaIcon },
    { key: 'native', label: 'Native', hint: 'MegaETH core', iconSrc: '/logos/MegaETH.webp', Icon: NativeCoreIcon },
    { key: 'mobile', label: 'Mobile', hint: 'Phone-native', Icon: MobileIcon }
];
export const FilterOrbitPanel = ({ isInteracting = false }) => {
    const { projectPoolSize, categories, categoryCounts, activeCategory, setActiveCategory, filters, toggleFilter } = useConstellation();
    const totalProjects = projectPoolSize;
    const quickSelect = (category) => {
        if (category && activeCategory === category) {
            setActiveCategory(null);
            return;
        }
        setActiveCategory(category);
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `trait-dock ${isInteracting ? 'ui-panel--hidden' : ''}`, children: _jsx("div", { className: "trait-menu", role: "group", "aria-label": "Signal traits", children: SPECIAL_FILTERS.map(({ key, label, hint, Icon, iconSrc }) => (_jsxs("button", { type: "button", className: filters[key] ? 'chip chip--trait active' : 'chip chip--trait', onClick: () => toggleFilter(key), "aria-pressed": filters[key], children: [_jsx("span", { className: "chip__leading-icon", children: iconSrc ? _jsx("img", { src: iconSrc, alt: "", "aria-hidden": true }) : Icon ? _jsx(Icon, {}) : null }), _jsxs("span", { className: "chip__stack", children: [_jsx("span", { className: "chip-label", children: label }), hint ? _jsx("span", { className: "chip-hint", children: hint }) : null] })] }, key))) }) }), _jsx("div", { className: `category-dock ${isInteracting ? 'ui-panel--hidden' : ''}`, children: _jsxs("aside", { className: "category-rail", "aria-label": "Categories", children: [_jsx("p", { className: "category-rail__section-heading", children: "Sectors" }), _jsxs("div", { className: "category-rail__list", role: "tablist", children: [_jsxs("button", { className: activeCategory === null ? 'chip chip--category active' : 'chip chip--category', type: "button", style: activeCategory === null
                                        ? {
                                            borderColor: 'var(--accent)',
                                            backgroundColor: 'var(--accent)',
                                            color: '#05060f'
                                        }
                                        : { borderColor: 'var(--accent)', backgroundColor: 'transparent' }, onClick: () => quickSelect(null), "aria-pressed": activeCategory === null, children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", style: activeCategory === null ? { color: '#05060f' } : undefined, children: totalProjects })] }), categories.map((category) => {
                                    const accent = getCategoryColor(category);
                                    const isActive = activeCategory === category;
                                    const style = isActive
                                        ? { borderColor: accent, backgroundColor: accent, color: '#05060f' }
                                        : { borderColor: accent, backgroundColor: 'transparent' };
                                    return (_jsxs("button", { className: activeCategory === category ? 'chip chip--category active' : 'chip chip--category', type: "button", style: style, onClick: () => quickSelect(category), "aria-pressed": activeCategory === category, children: [_jsx("span", { className: "chip-label", children: formatCategoryLabel(category) }), _jsx("span", { className: "chip-count", style: isActive ? { color: '#05060f' } : undefined, children: categoryCounts[category] ?? 0 })] }, category));
                                })] })] }) })] }));
};
