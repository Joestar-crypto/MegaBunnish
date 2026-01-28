import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider, useConstellation } from './state/constellation';
const AppContent = () => {
    const [isInteracting, setIsInteracting] = useState(false);
    const { resetCamera } = useConstellation();
    const handleInteractionStart = useCallback(() => {
        setIsInteracting(true);
    }, []);
    const handleInteractionEnd = useCallback(() => {
        setIsInteracting(false);
    }, []);
    return (_jsxs("div", { className: "app-shell app-shell--immersive", children: [_jsxs("div", { className: "immersive-stage", children: [_jsx("div", { className: "immersive-stage__background", children: _jsx(ConstellationCanvas, { onInteractionStart: handleInteractionStart, onInteractionEnd: handleInteractionEnd }) }), _jsx("div", { className: `hero-overlay ${isInteracting ? 'hero-overlay--hidden' : ''}`, children: _jsxs("div", { className: "hero-overlay__content", children: [_jsx("p", { className: "eyebrow", children: "MegaETH ecosystem" }), _jsx("h1", { children: "MegaBunnish" }), _jsxs("a", { className: "hero-overlay__credit", href: "https://x.com/JoestarCrypto", target: "_blank", rel: "noreferrer noopener", children: [_jsx("span", { className: "hero-overlay__credit-label", children: "Made by Joestar" }), _jsx("span", { className: "hero-overlay__credit-avatar", "aria-hidden": "true", children: _jsx("img", { src: "/logos/Jojo2.webp", alt: "" }) })] })] }) }), _jsx(FilterOrbitPanel, { isInteracting: isInteracting }), _jsx("button", { type: "button", className: "reset-anchor", onClick: resetCamera, "aria-label": "Reset camera view", children: "Reset" }), _jsx(ProjectDetailDrawer, {})] }), _jsx("div", { className: "mobile-overlay", children: "Please visit this site on desktop for the ultimate experience." })] }));
};
const App = () => {
    return (_jsx(ConstellationProvider, { children: _jsx(AppContent, {}) }));
};
export default App;
