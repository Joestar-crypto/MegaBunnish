import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
const MegamafiaIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("path", { d: "M4 9h16", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", opacity: 0.4 }), _jsx("path", { d: "M7 11h10l-1 5a4 4 0 0 1-8 0z", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" }), _jsx("circle", { cx: 9.5, cy: 15, r: 1, fill: "currentColor" }), _jsx("circle", { cx: 14.5, cy: 15, r: 1, fill: "currentColor" })] }));
const MobileIcon = () => (_jsxs("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: [_jsx("rect", { x: 7.5, y: 3.5, width: 9, height: 17, rx: 2, stroke: "currentColor", strokeWidth: 1.5 }), _jsx("line", { x1: 7.5, y1: 7.5, x2: 16.5, y2: 7.5, stroke: "currentColor", strokeWidth: 1.5, opacity: 0.5 }), _jsx("circle", { cx: 12, cy: 17.5, r: 0.9, fill: "currentColor" })] }));
const formatCategoryLabel = (category) => category === 'Prediction Market' ? 'Prediction M.' : category;
const SPECIAL_FILTERS = [
    { key: 'megamafia', label: 'Megamafia', Icon: MegamafiaIcon },
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
    return (_jsxs("aside", { className: `category-rail ${isInteracting ? 'category-rail--hidden' : ''}`, "aria-label": "Constellation filters", children: [_jsxs("section", { className: "category-rail__section", "aria-label": "Special traits", children: [_jsx("p", { className: "category-rail__section-heading", children: "Signal traits" }), _jsx("div", { className: "category-rail__special-grid", children: SPECIAL_FILTERS.map(({ key, label, hint, Icon }) => (_jsxs("button", { type: "button", className: filters[key] ? 'chip chip--trait active' : 'chip chip--trait', onClick: () => toggleFilter(key), "aria-pressed": filters[key], children: [_jsx("span", { className: "chip__leading-icon", children: _jsx(Icon, {}) }), _jsxs("span", { className: "chip__stack", children: [_jsx("span", { className: "chip-label", children: label }), hint ? _jsx("span", { className: "chip-hint", children: hint }) : null] })] }, key))) })] }), _jsxs("section", { className: "category-rail__section", "aria-label": "Categories", children: [_jsx("p", { className: "category-rail__section-heading", children: "Sectors" }), _jsxs("div", { className: "category-rail__list", role: "tablist", children: [_jsxs("button", { className: activeCategory === null ? 'chip active' : 'chip', type: "button", onClick: () => quickSelect(null), "aria-pressed": activeCategory === null, children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", children: totalProjects })] }), categories.map((category) => (_jsxs("button", { className: activeCategory === category ? 'chip active' : 'chip', type: "button", onClick: () => quickSelect(category), "aria-pressed": activeCategory === category, children: [_jsx("span", { className: "chip-label", children: formatCategoryLabel(category) }), _jsx("span", { className: "chip-count", children: categoryCounts[category] ?? 0 })] }, category)))] })] })] }));
};
