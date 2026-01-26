import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
export const FilterOrbitPanel = () => {
    const { projects, categories, categoryCounts, activeCategory, setActiveCategory, resetCamera } = useConstellation();
    const totalProjects = projects.length;
    return (_jsxs("aside", { className: "filter-panel", children: [_jsxs("header", { children: [_jsx("p", { className: "eyebrow", children: "Navigate" }), _jsx("h2", { children: "Choose your sector" })] }), _jsxs("div", { className: "chips", children: [_jsxs("button", { className: activeCategory === null ? 'chip active' : 'chip', type: "button", onClick: () => {
                            setActiveCategory(null);
                            resetCamera();
                        }, children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", children: totalProjects })] }), categories.map((category) => (_jsxs("button", { className: activeCategory === category ? 'chip active' : 'chip', type: "button", onClick: () => setActiveCategory(category), children: [_jsx("span", { className: "chip-label", children: category }), _jsx("span", { className: "chip-count", children: categoryCounts[category] ?? 0 })] }, category)))] }), _jsxs("section", { className: "hint-block", children: [_jsx("p", { children: "Right-click and drag anywhere inside the constellation to glide through space." }), _jsx("p", { children: "Scroll to zoom via browser controls for even more focus." })] })] }));
};
