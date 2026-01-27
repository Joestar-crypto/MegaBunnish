import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useConstellation } from '../state/constellation';
export const ConstellationHUD = () => {
    const { projects } = useConstellation();
    const stats = useMemo(() => {
        const incentives = projects.flatMap((project) => project.incentives);
        return {
            totalProjects: projects.length,
            activeIncentives: incentives.length
        };
    }, [projects]);
    return (_jsxs("div", { className: "hud-card", children: [_jsx("p", { className: "eyebrow", children: "Constellation" }), _jsxs("h3", { children: [stats.totalProjects, " active orbs"] }), _jsxs("p", { className: "muted", children: [stats.activeIncentives, " live incentives glowing left now."] }), _jsxs("div", { className: "hud-actions", children: [_jsx("span", { children: "Left-click drag to explore" }), _jsx("span", { children: "Click nodes for intel" }), _jsx("span", { children: "Scroll or pinch to zoom" })] })] }));
};
