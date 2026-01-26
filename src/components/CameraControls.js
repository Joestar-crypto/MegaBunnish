import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConstellation } from '../state/constellation';
export const CameraControls = ({ isHidden = false }) => {
    const { zoomCamera, resetCamera } = useConstellation();
    const handleZoom = (delta) => () => {
        zoomCamera(delta);
    };
    return (_jsxs("div", { className: `camera-controls ${isHidden ? 'camera-controls--hidden' : ''}`, role: "toolbar", "aria-label": "Camera controls", children: [_jsx("button", { type: "button", "aria-label": "Zoom out", onClick: handleZoom(0.18), children: "-" }), _jsx("button", { type: "button", "aria-label": "Zoom in", onClick: handleZoom(-0.18), children: "+" }), _jsx("button", { type: "button", "aria-label": "Reset view", onClick: () => resetCamera(), children: "reset" })] }));
};
