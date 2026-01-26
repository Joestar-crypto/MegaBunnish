import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
export const FilterOrbitPanel = ({ isInteracting = false }) => {
    const { projects, categories, categoryCounts, activeCategory, setActiveCategory, resetCamera, filters, toggleFilter } = useConstellation();
    const totalProjects = projects.length;
    const quickSelect = (category) => {
        if (category === null) {
            setActiveCategory(null);
            resetCamera();
            return;
        }
        setActiveCategory(category);
    };
    const overlayFilters = [
        { key: 'megamafia', label: 'Megamafia' },
        { key: 'mobile', label: 'Mobile' }
    ];
    return (_jsxs("aside", { className: `category-rail ${isInteracting ? 'category-rail--hidden' : ''}`, "aria-label": "Constellation filters", children: [_jsx("div", { className: "category-rail__special", children: overlayFilters.map((filter) => (_jsx("button", { type: "button", className: filters[filter.key] ? 'chip active' : 'chip', onClick: () => toggleFilter(filter.key), children: _jsx("span", { className: "chip-label", children: filter.label }) }, filter.key))) }), _jsx("div", { className: "category-rail__divider", "aria-hidden": true }), _jsxs("div", { className: "category-rail__list", role: "tablist", children: [_jsxs("button", { className: activeCategory === null ? 'chip active' : 'chip', type: "button", onClick: () => quickSelect(null), children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", children: totalProjects })] }), categories.map((category) => (_jsxs("button", { className: activeCategory === category ? 'chip active' : 'chip', type: "button", onClick: () => quickSelect(category), children: [_jsx("span", { className: "chip-label", children: category }), _jsx("span", { className: "chip-count", children: categoryCounts[category] ?? 0 })] }, category)))] })] }));
};
