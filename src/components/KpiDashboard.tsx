import { useEffect, useMemo } from 'react';
import { useUsdmSupply, USDM_SUPPLY_GOAL, type UsdmSupplyState } from '../state/useUsdmSupply';

type KpiDashboardProps = {
  isOpen: boolean;
  onClose: () => void;
};

type KpiCard = {
  id: string;
  title?: string;
  label: string;
  iconSrc?: string;
  description?: string;
  delta: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  primaryStat?: string;
  secondaryStat?: string;
  footer?: string;
  status?: 'ready' | 'loading' | 'error' | 'static';
  error?: string | null;
  statusBadge?: {
    tone: 'positive' | 'negative';
    symbol: string;
    label: string;
  };
  progress?: {
    value: number;
    label: string;
    tone?: 'positive' | 'negative' | 'neutral';
  };
  listItems?: KpiListItem[];
};

type KpiListItem = {
  id: string;
  name: string;
  logoSrc: string;
  status: 'live' | 'pending';
};

const KPI2_TARGET = 10;
const KPI2_LIVE_IDS = new Set(['kumbaya', 'avon', 'cap', 'ubitel', 'showdown']);
const KPI2_APPS: Array<{ id: string; name: string; logoSrc: string }> = [
  { id: 'kumbaya', name: 'Kumbaya', logoSrc: '/logos/Kumbaya.webp' },
  { id: 'rocket', name: 'Rocket', logoSrc: '/logos/Rocket.webp' },
  { id: 'hunch', name: 'Hunch', logoSrc: '/logos/Hunch.webp' },
  { id: 'nectar-ai', name: 'NectarAI', logoSrc: '/logos/NectarAI.webp' },
  { id: 'everwatch', name: 'Everwatch', logoSrc: '/logos/Everwatch.webp' },
  { id: 'worldmarkets', name: 'WorldMarkets', logoSrc: '/logos/Worldmarkets.webp' },
  { id: 'euphoria', name: 'Euphoria', logoSrc: '/logos/Euphoria.webp' },
  { id: 'blitzo', name: 'Blitzo', logoSrc: '/logos/Blitzo.webp' },
  { id: 'funes', name: 'Funes', logoSrc: '/logos/Funes.webp' },
  { id: 'cilium', name: 'Cilium', logoSrc: '/logos/Cilium.webp' },
  { id: 'brix', name: 'Brix', logoSrc: '/logos/Brix.webp' },
  { id: 'cap', name: 'Cap', logoSrc: '/logos/CapMoney.webp' },
  { id: 'benchmark', name: 'Benchmark', logoSrc: '/logos/Benchmark.webp' },
  { id: 'avon', name: 'Avon', logoSrc: '/logos/Avon.webp' },
  { id: 'blackhaven', name: 'Blackhaven', logoSrc: '/logos/Blackhaven.webp' },
  { id: 'ubitel', name: 'Ubitel', logoSrc: '/logos/Ubitel.webp' },
  { id: 'hellotrade', name: 'Hellotrade', logoSrc: '/logos/Hellotrade.webp' },
  { id: 'lemonade', name: 'Lemonade', logoSrc: '/logos/Lemonade.webp' },
  { id: 'dorado', name: 'Dorado', logoSrc: '/logos/Dorado.webp' },
  { id: 'showdown', name: 'Showdown', logoSrc: '/logos/Showdown.webp' }
];

const KPI3_PLACEHOLDER: KpiCard = {
  id: 'kpi-3',
  label: 'KPI 3',
  description: 'Third chart placeholder awaiting your data.',
  delta: '+12.0%',
  deltaTone: 'positive',
  status: 'static'
};

const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const buildActivationCard = (): KpiCard => {
  const listItems: KpiListItem[] = KPI2_APPS.map((app) => ({
    ...app,
    status: KPI2_LIVE_IDS.has(app.id) ? 'live' : 'pending'
  }));
  const liveCount = listItems.filter((item) => item.status === 'live').length;
  const progressValue = Math.min(liveCount / KPI2_TARGET, 1);
  return {
    id: 'kpi-2',
    title: 'KPI 2',
    label: 'Apps live',
    delta: `${liveCount} / ${KPI2_TARGET}`,
    deltaTone: liveCount >= KPI2_TARGET ? 'positive' : 'negative',
    primaryStat: `${liveCount} apps live`,
    status: liveCount >= KPI2_TARGET ? 'ready' : 'loading',
    statusBadge: {
      tone: liveCount >= KPI2_TARGET ? 'positive' : 'negative',
      symbol: liveCount >= KPI2_TARGET ? '✔' : '✕',
      label: liveCount >= KPI2_TARGET ? 'Goal reached' : 'More apps to activate'
    },
    progress: {
      value: progressValue,
      label: `${liveCount} / ${KPI2_TARGET} apps live`,
      tone: liveCount >= KPI2_TARGET ? 'positive' : 'neutral'
    },
    listItems
  };
};

const buildUsdmSupplyCard = (supplyState: UsdmSupplyState): KpiCard => {
  if (supplyState.status === 'ready') {
    const { data } = supplyState;
    const isTargetMet = data.currentSupply >= 500_000_000;
    const hasGoal = USDM_SUPPLY_GOAL > 0;
    const rawProgress = hasGoal ? data.currentSupply / USDM_SUPPLY_GOAL : 0;
    const clampedProgress = Math.max(0, Math.min(rawProgress, 1));
    const progressPct = hasGoal ? rawProgress * 100 : 0;
    return {
      id: 'usdm-supply',
      title: 'KPI 1',
      label: `${data.symbol} supply`,
      iconSrc: '/logos/USDM.png',
      delta: formatDelta(data.deltaPct),
      deltaTone: data.deltaPct >= 0 ? 'positive' : 'negative',
      primaryStat: `${data.currentSupplyLabel} ${data.symbol}`,
      status: 'ready',
      statusBadge: {
        tone: isTargetMet ? 'positive' : 'negative',
        symbol: isTargetMet ? '✔' : '✕',
        label: isTargetMet ? 'Supply above 500M' : 'Supply below 500M'
      },
      progress: hasGoal
        ? {
            value: clampedProgress,
            label: `${progressPct.toFixed(1)}% de 500M`,
            tone: isTargetMet ? 'positive' : 'neutral'
          }
        : undefined
    };
  }

  if (supplyState.status === 'error') {
    return {
      id: 'usdm-supply',
      title: 'KPI 1',
      label: 'USDM supply',
      iconSrc: '/logos/USDM.png',
      delta: 'Offline',
      deltaTone: 'neutral',
      primaryStat: '—',
      error: supplyState.error,
      status: 'error',
      statusBadge: {
        tone: 'negative',
        symbol: '✕',
        label: 'Supply unavailable'
      }
    };
  }

  return {
    id: 'usdm-supply',
    title: 'KPI 1',
    label: 'USDM supply',
    iconSrc: '/logos/USDM.png',
    delta: 'Loading…',
    deltaTone: 'neutral',
    primaryStat: 'Loading…',
    status: 'loading',
    statusBadge: {
      tone: 'negative',
      symbol: '✕',
      label: 'Supply pending'
    }
  };
};

export const KpiDashboard = ({ isOpen, onClose }: KpiDashboardProps) => {
  const usdmSupply = useUsdmSupply();

  const cards = useMemo(() => {
    const supplyCard = buildUsdmSupplyCard(usdmSupply);
    const activationCard = buildActivationCard();
    return [supplyCard, activationCard, KPI3_PLACEHOLDER];
  }, [usdmSupply]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <div className={`mission-control ${isOpen ? 'mission-control--visible' : ''}`} aria-hidden={!isOpen}>
      <div className="mission-control__backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="mission-control__content"
        role="dialog"
        aria-modal="true"
        aria-label="Mission control KPI window"
        tabIndex={-1}
      >
        <header className="mission-control__header">
          <div>
            <p className="mission-control__eyebrow">Mission control</p>
            <h2>KPI dashboards</h2>
            <p>Full-screen view of the 3 charts: KPI 1 (USDM supply), KPI 2, and KPI 3.</p>
          </div>
          <button type="button" className="mission-control__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="kpi-dashboard__grid">
          {cards.map((card) => {
            const progressFillClass = card.progress?.tone
              ? `kpi-card__progress-fill kpi-card__progress-fill--${card.progress.tone}`
              : 'kpi-card__progress-fill';
            return (
              <article key={card.id} className="kpi-card">
                {card.title && (
                  <div className="kpi-card__title-row">
                    <p className="kpi-card__title">{card.title}</p>
                    {card.statusBadge && (
                      <span
                        className={`kpi-card__status-icon kpi-card__status-icon--${card.statusBadge.tone}`}
                        aria-label={card.statusBadge.label}
                      >
                        {card.statusBadge.symbol}
                      </span>
                    )}
                  </div>
                )}
                <div className="kpi-card__header">
                  <div className="kpi-card__label">
                    {card.iconSrc && <img src={card.iconSrc} alt={`${card.label} icon`} />}
                    <span>{card.label}</span>
                  </div>
                  <span className={`kpi-card__delta${card.deltaTone ? ` kpi-card__delta--${card.deltaTone}` : ''}`}>
                    {card.delta}
                  </span>
                </div>
                {card.description ? <p className="kpi-card__description">{card.description}</p> : null}
                {card.primaryStat && <p className="kpi-card__stat">{card.primaryStat}</p>}
                {card.secondaryStat && <p className="kpi-card__meta">{card.secondaryStat}</p>}
                {card.footer && <p className="kpi-card__meta kpi-card__meta--muted">{card.footer}</p>}
                {card.status === 'error' && card.error && <p className="kpi-card__error">{card.error}</p>}
                {card.progress ? (
                  <div className="kpi-card__progress" role="img" aria-label={`Progress ${card.progress.label}`}>
                    <div className="kpi-card__progress-track">
                      <div className={progressFillClass} style={{ width: `${Math.min(card.progress.value, 1) * 100}%` }} />
                    </div>
                    <span className="kpi-card__progress-label">{card.progress.label}</span>
                  </div>
                ) : null}
                {card.listItems ? (
                  <ul className="kpi-card__list">
                    {card.listItems.map((item) => (
                      <li key={item.id} className="kpi-card__list-item">
                        <span className="kpi-card__list-info" aria-label={item.name}>
                          <img src={item.logoSrc} alt="" aria-hidden="true" className="kpi-card__list-avatar" />
                        </span>
                        <span
                          className={`kpi-card__list-status kpi-card__list-status--${item.status}`}
                          aria-label={item.status === 'live' ? 'Live app' : 'Pending'}
                        >
                          {item.status === 'live' ? '✔' : '✕'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
