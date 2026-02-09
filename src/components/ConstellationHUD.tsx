type ConstellationHUDProps = {
  onOpenDashboards?: () => void;
};

export const ConstellationHUD = ({ onOpenDashboards }: ConstellationHUDProps) => {
  if (!onOpenDashboards) {
    return null;
  }

  return (
    <div className="hud-card hud-card--compact">
      <button
        type="button"
        className="hud-card__cta hud-card__cta--compact"
        onClick={onOpenDashboards}
        aria-label="Ouvrir les KPI"
      >
        <span>KPI</span>
        <span className="hud-card__cta-glow" aria-hidden="true">
          <span />
        </span>
      </button>
    </div>
  );
};
