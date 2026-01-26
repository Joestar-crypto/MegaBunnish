import { useConstellation } from '../state/constellation';

type CameraControlsProps = {
  isHidden?: boolean;
};

export const CameraControls = ({ isHidden = false }: CameraControlsProps) => {
  const { zoomCamera, resetCamera } = useConstellation();

  const handleZoom = (delta: number) => () => {
    zoomCamera(delta);
  };

  return (
    <div
      className={`camera-controls ${isHidden ? 'camera-controls--hidden' : ''}`}
      role="toolbar"
      aria-label="Camera controls"
    >
      <button type="button" aria-label="Zoom out" onClick={handleZoom(0.18)}>
        -
      </button>
      <button type="button" aria-label="Zoom in" onClick={handleZoom(-0.18)}>
        +
      </button>
      <button type="button" aria-label="Reset view" onClick={() => resetCamera()}>
        reset
      </button>
    </div>
  );
};