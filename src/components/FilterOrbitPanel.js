import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
export const FilterOrbitPanel = () => {
    const { projects, categories, categoryCounts, activeCategory, setActiveCategory, resetCamera } = useConstellation();
    const totalProjects = projects.length;
    return (_jsxs("aside", { className: "filter-panel", children: [_jsxs("header", { className: "filter-hero", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "MegaBunnish mission control" }), _jsx("h2", { children: "Cluster autopilot" }), _jsx("p", { className: "hero-lede", children: "Rocket keeps every curated primitive, NFT drop lane, and Depin corridor aligned inside this panel." })] }), _jsx("img", { src: "/logos/Rocket.svg", alt: "Rocket sensor", className: "filter-hero__rocket", loading: "lazy" })] }), _jsxs("div", { className: "chips", children: [_jsxs("button", { className: activeCategory === null ? 'chip active' : 'chip', type: "button", onClick: () => {
                            setActiveCategory(null);
                            resetCamera();
                        }, children: [_jsx("span", { className: "chip-label", children: "All" }), _jsx("span", { className: "chip-count", children: totalProjects })] }), categories.map((category) => (_jsxs("button", { className: activeCategory === category ? 'chip active' : 'chip', type: "button", onClick: () => setActiveCategory(category), children: [_jsx("span", { className: "chip-label", children: category }), _jsx("span", { className: "chip-count", children: categoryCounts[category] ?? 0 })] }, category)))] }), _jsxs("section", { className: "hint-block", children: [_jsx("p", { children: "Left-click and drag to glide; zoom via browser controls for surgical focus." }), _jsx("p", { children: "Each chip recenters on its curated cluster without the extra noise." })] })] }));
};
