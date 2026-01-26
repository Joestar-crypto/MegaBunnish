import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { ConstellationHUD } from './components/ConstellationHUD';
import { FilterOrbitPanel } from './components/FilterOrbitPanel';
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer';
import { ConstellationProvider } from './state/constellation';
const AppContent = () => {
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "site-heading", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "MegaBunnish ecosystems" }), _jsx("h1", { children: "Command the MegaBunnish field" }), _jsx("p", { className: "muted", children: "The ops board keeps every primitive, live documentation link, and incentive ping inside a single viewport." })] }) }), _jsxs("main", { className: "constellation-grid", children: [_jsx(FilterOrbitPanel, {}), _jsxs("section", { className: "canvas-stage", children: [_jsx(ConstellationCanvas, {}), _jsx(ConstellationHUD, {}), _jsx(ProjectDetailDrawer, {})] })] })] }));
};
const App = () => {
    return (_jsx(ConstellationProvider, { children: _jsx(AppContent, {}) }));
};
export default App;
