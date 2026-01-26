import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider } from './state/constellation';
const AppContent = () => {
    const [isInteracting, setIsInteracting] = useState(false);
    const handleInteractionStart = useCallback(() => {
        setIsInteracting(true);
    }, []);
    const handleInteractionEnd = useCallback(() => {
        setIsInteracting(false);
    }, []);
    return (_jsx("div", { className: "app-shell app-shell--immersive", children: _jsxs("div", { className: "immersive-stage", children: [_jsx("div", { className: "immersive-stage__background", children: _jsx(ConstellationCanvas, { onInteractionStart: handleInteractionStart, onInteractionEnd: handleInteractionEnd }) }), _jsxs("div", { className: `hero-overlay ${isInteracting ? 'hero-overlay--hidden' : ''}`, children: [_jsx("p", { className: "eyebrow", children: "MegaETH ecosystem" }), _jsx("h1", { children: "MegaBunnish" })] }), _jsx(FilterOrbitPanel, { isInteracting: isInteracting }), _jsx(ProjectDetailDrawer, {})] }) }));
};
const App = () => {
    return (_jsx(ConstellationProvider, { children: _jsx(AppContent, {}) }));
};
export default App;
