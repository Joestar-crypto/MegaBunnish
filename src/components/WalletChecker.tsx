import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useConstellation } from '../state/constellation';

const MERKL_API_BASE = 'https://api.merkl.xyz';
const AVON_PROTOCOL_ID = 'avon';
const AVON_POINTS_LABEL = 'Avon Points';
const AVON_OPPORTUNITY_IDENTIFIER = '0x2ea493384f42d7ea78564f3ef4c86986eab4a890';
const AVON_OPPORTUNITY_TYPE = 'erc20logprocessor';

type MerklRewardEntry = {
  amount: string;
  pending?: string;
  recipient: string;
};

type OpportunityWithCampaign = {
  type?: string;
  identifier?: string;
  name?: string;
  protocol?: { id?: string };
  chainId?: number;
  campaigns?: Array<{
    id?: string;
    campaignId?: string;
    distributionChainId?: number;
    startTimestamp?: number;
    endTimestamp?: number;
    rewardToken?: {
      type?: string;
      decimals?: number;
      symbol?: string;
      displaySymbol?: string;
      name?: string;
    };
  }>;
};

type AvonPointCampaign = {
  dbCampaignId: string;
  publicCampaignId: string;
  chainId: number;
  decimals: number;
};

type LeaderboardEntry = {
  rank: number;
  address: string;
  pointsLabel: string;
  isCurrentWallet: boolean;
};

type LeaderboardStatus = 'idle' | 'loading' | 'ready' | 'error';

type RankPresentation = {
  pillClassName: string;
  insigniaClassName: string;
  stars: number;
  bars: number;
};

const shortenAddress = (value: string) => {
  if (!value) {
    return '';
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const formatPoints = (rawAmount: string, decimals: number) => {
  try {
    const base = BigInt(10) ** BigInt(decimals);
    const amount = BigInt(rawAmount || '0');
    const whole = amount / base;
    const fraction = amount % base;
    const fractionTwoDigits = ((fraction * 100n) / base).toString().padStart(2, '0');
    return `${whole.toLocaleString()}.${fractionTwoDigits}`;
  } catch {
    return '0.00';
  }
};

const parseAmount = (value: string | undefined) => {
  if (!value) {
    return 0n;
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const scaleAmount = (value: bigint, fromDecimals: number, toDecimals: number) => {
  if (toDecimals <= fromDecimals) {
    return value;
  }
  return value * 10n ** BigInt(toDecimals - fromDecimals);
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Merkl API error (${response.status})`);
  }
  return (await response.json()) as T;
};

const formatTimestamp = (value: number) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return formatter.format(value);
};

const getRankPresentation = (rank: number | null): RankPresentation => {
  if (!rank || rank <= 0) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--unranked',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--none',
      stars: 0,
      bars: 0
    };
  }

  if (rank === 1) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 3,
      bars: 0
    };
  }

  if (rank === 2) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 2,
      bars: 0
    };
  }

  if (rank === 3) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 1,
      bars: 0
    };
  }

  if (rank >= 4 && rank <= 9) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 0,
      bars: 3
    };
  }

  if (rank >= 10 && rank <= 14) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 0,
      bars: 2
    };
  }

  if (rank >= 15 && rank <= 20) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--gold',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--gold',
      stars: 0,
      bars: 1
    };
  }

  if (rank >= 21 && rank <= 25) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 3,
      bars: 0
    };
  }

  if (rank >= 26 && rank <= 30) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 2,
      bars: 0
    };
  }

  if (rank >= 31 && rank <= 35) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 1,
      bars: 0
    };
  }

  if (rank >= 36 && rank <= 55) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 0,
      bars: 3
    };
  }

  if (rank >= 56 && rank <= 75) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 0,
      bars: 2
    };
  }

  if (rank >= 76 && rank <= 100) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--silver',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--silver',
      stars: 0,
      bars: 1
    };
  }

  if (rank >= 101 && rank <= 120) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 3,
      bars: 0
    };
  }

  if (rank >= 121 && rank <= 141) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 2,
      bars: 0
    };
  }

  if (rank >= 142 && rank <= 161) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 1,
      bars: 0
    };
  }

  if (rank >= 162 && rank <= 200) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 0,
      bars: 3
    };
  }

  if (rank >= 201 && rank <= 250) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 0,
      bars: 2
    };
  }

  if (rank >= 251 && rank <= 300) {
    return {
      pillClassName: 'wallet-checker__leaderboard-pill--bronze',
      insigniaClassName: 'wallet-checker__leaderboard-insignia--bronze',
      stars: 0,
      bars: 1
    };
  }

  return {
    pillClassName: 'wallet-checker__leaderboard-pill--unranked',
    insigniaClassName: 'wallet-checker__leaderboard-insignia--none',
    stars: 0,
    bars: 0
  };
};

type WalletCheckerProps = {
  isInteracting?: boolean;
};

export const WalletChecker = ({ isInteracting = false }: WalletCheckerProps) => {
  const LEADERBOARD_PAGE_SIZE = 20;
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>('idle');
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [walletRank, setWalletRank] = useState<number | null>(null);
  const [walletPointsLabel, setWalletPointsLabel] = useState<string | null>(null);
  const [leaderboardTokenLabel, setLeaderboardTokenLabel] = useState(AVON_POINTS_LABEL);
  const {
    walletAddress,
    walletInput,
    walletStatus,
    walletError,
    walletUpdatedAt,
    walletInteractionCounts,
    walletNftHoldings,
    contractDirectoryStatus,
    setWalletInput,
    submitWallet,
    clearWallet,
    refreshWalletInsights,
    resolveProjectById,
    selectedProjectId
  } = useConstellation();

  useEffect(() => {
    if (selectedProjectId) {
      setIsOpen(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    setIsLeaderboardOpen(false);
    setLeaderboardStatus('idle');
    setLeaderboardError(null);
    setLeaderboardEntries([]);
    setLeaderboardPage(0);
    setWalletRank(null);
    setWalletPointsLabel(null);
    setLeaderboardTokenLabel(AVON_POINTS_LABEL);
  }, [walletAddress]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitWallet();
    setIsOpen(false);
  };

  const topInteractions = useMemo(() => {
    return Object.entries(walletInteractionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([projectId, count]) => ({
        id: projectId,
        count,
        name: resolveProjectById(projectId)?.name ?? projectId
      }));
  }, [walletInteractionCounts, resolveProjectById]);

  const trackedNfts = useMemo(() => {
    return Object.entries(walletNftHoldings)
      .sort(([, a], [, b]) => b - a)
      .map(([projectId, count]) => ({
        id: projectId,
        count,
        name: resolveProjectById(projectId)?.name ?? projectId
      }));
  }, [walletNftHoldings, resolveProjectById]);

  const isBusy = walletStatus === 'loading' || contractDirectoryStatus === 'loading';
  const hasWallet = Boolean(walletAddress);
  const hasInsights = topInteractions.length > 0 || trackedNfts.length > 0;

  const loadAvonLeaderboard = useCallback(async () => {
    if (!walletAddress) {
      return;
    }

    setLeaderboardStatus('loading');
    setLeaderboardError(null);

    try {
      const campaignMap = new Map<string, AvonPointCampaign>();

      const opportunitiesUrl = `${MERKL_API_BASE}/v4/opportunities?search=${encodeURIComponent(
        AVON_OPPORTUNITY_IDENTIFIER
      )}&campaigns=true&items=50&page=0`;
      const opportunitiesResponse = await fetchJson<OpportunityWithCampaign[] | OpportunityWithCampaign>(
        opportunitiesUrl
      );
      const opportunities = Array.isArray(opportunitiesResponse)
        ? opportunitiesResponse
        : opportunitiesResponse
          ? [opportunitiesResponse]
          : [];

      const targetOpportunities = opportunities.filter((opportunity) => {
        const protocolId = (opportunity.protocol?.id ?? '').toLowerCase();
        const identifier = (opportunity.identifier ?? '').toLowerCase();
        const type = (opportunity.type ?? '').toLowerCase();
        return (
          protocolId === AVON_PROTOCOL_ID &&
          identifier === AVON_OPPORTUNITY_IDENTIFIER &&
          type === AVON_OPPORTUNITY_TYPE
        );
      });

      targetOpportunities.forEach((opportunity) => {
        (opportunity.campaigns ?? []).forEach((campaign) => {
          const nowUnix = Math.floor(Date.now() / 1000);
          const startTimestamp = Number(campaign.startTimestamp ?? 0);
          const endTimestamp = Number(campaign.endTimestamp ?? 0);
          const isLiveCampaign = startTimestamp > 0 && endTimestamp > 0 && startTimestamp <= nowUnix && nowUnix <= endTimestamp;
          if (!isLiveCampaign) {
            return;
          }

          const rewardType = (campaign.rewardToken?.type ?? '').toUpperCase();
          if (rewardType !== 'POINT') {
            return;
          }

          const publicCampaignId = campaign.campaignId;
          const dbCampaignId = campaign.id;
          const chainId = campaign.distributionChainId ?? opportunity.chainId;
          if (!publicCampaignId || !dbCampaignId || !chainId) {
            return;
          }

          const dedupeKey = `${chainId}:${publicCampaignId}`;
          campaignMap.set(dedupeKey, {
            dbCampaignId,
            publicCampaignId,
            chainId,
            decimals: campaign.rewardToken?.decimals ?? 18
          });
        });
      });

      const campaigns = Array.from(campaignMap.values());
      if (!campaigns.length) {
        throw new Error('Unable to find Avon point campaigns.');
      }

      const aggregationDecimals = campaigns.reduce((max, campaign) => Math.max(max, campaign.decimals), 0);
      const totalsByWallet = new Map<string, bigint>();
      const walletLower = walletAddress.toLowerCase();
      const pageSize = 200;

      for (const campaign of campaigns) {
        for (let page = 0; page < 1000; page += 1) {
          const rewardsUrl = `${MERKL_API_BASE}/v4/rewards/?chainId=${campaign.chainId}&campaignId=${encodeURIComponent(
            campaign.publicCampaignId
          )}&items=${pageSize}&page=${page}&hide=true`;

          const rewards = await fetchJson<MerklRewardEntry[]>(rewardsUrl);
          if (!rewards.length) {
            break;
          }

          rewards.forEach((entry) => {
            const address = entry.recipient.toLowerCase();
            const rawAmount = parseAmount(entry.amount) + parseAmount(entry.pending);
            const normalizedAmount = scaleAmount(rawAmount, campaign.decimals, aggregationDecimals);
            const previousAmount = totalsByWallet.get(address) ?? 0n;
            totalsByWallet.set(address, previousAmount + normalizedAmount);
          });

          if (rewards.length < pageSize) {
            break;
          }
        }

        if (!totalsByWallet.has(walletLower)) {
          const campaignListUrl = `${MERKL_API_BASE}/v4/rewards/campaign/${campaign.dbCampaignId}/list?addresses=${walletAddress}`;
          const userReward = await fetchJson<Record<string, { amount?: string }>>(campaignListUrl);
          const userKey = Object.keys(userReward).find((key) => key.toLowerCase() === walletLower);
          if (userKey) {
            const rawAmount = parseAmount(userReward[userKey].amount);
            const normalizedAmount = scaleAmount(rawAmount, campaign.decimals, aggregationDecimals);
            const previousAmount = totalsByWallet.get(walletLower) ?? 0n;
            totalsByWallet.set(walletLower, previousAmount + normalizedAmount);
          }
        }
      }

      const sorted = Array.from(totalsByWallet.entries()).sort((a, b) => {
        if (a[1] === b[1]) {
          return a[0].localeCompare(b[0]);
        }
        return a[1] > b[1] ? -1 : 1;
      });

      const walletIndex = sorted.findIndex(([address]) => address === walletLower);
      const walletAmount = walletIndex >= 0 ? sorted[walletIndex][1] : 0n;

      const entries: LeaderboardEntry[] = sorted.map(([address, amount], index) => ({
        rank: index + 1,
        address,
        pointsLabel: formatPoints(amount.toString(), aggregationDecimals),
        isCurrentWallet: address === walletLower
      }));

      setLeaderboardTokenLabel(AVON_POINTS_LABEL);
      setLeaderboardEntries(entries);
      setLeaderboardPage(0);
      setWalletRank(walletIndex >= 0 ? walletIndex + 1 : null);
      setWalletPointsLabel(formatPoints(walletAmount.toString(), aggregationDecimals));
      setLeaderboardStatus('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load Avon leaderboard.';
      setLeaderboardError(message);
      setLeaderboardStatus('error');
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }
    void loadAvonLeaderboard();
  }, [walletAddress, loadAvonLeaderboard]);

  const handlePillClick = () => {
    if (!hasWallet) {
      return;
    }

    setIsLeaderboardOpen((previous) => {
      const next = !previous;
      if (next && leaderboardStatus === 'idle') {
        void loadAvonLeaderboard();
      }
      return next;
    });
  };

  const handleCloseLeaderboard = () => {
    setIsLeaderboardOpen(false);
  };

  const handleClearWallet = () => {
    clearWallet();
    setIsLeaderboardOpen(false);
  };

  const rootClasses = ['wallet-checker'];
  if (isOpen) {
    rootClasses.push('wallet-checker--open');
  }
  if (isInteracting) {
    rootClasses.push('ui-panel--hidden');
  }

  const paginatedLeaderboardEntries = useMemo(() => {
    const start = leaderboardPage * LEADERBOARD_PAGE_SIZE;
    return leaderboardEntries.slice(start, start + LEADERBOARD_PAGE_SIZE);
  }, [leaderboardEntries, leaderboardPage, LEADERBOARD_PAGE_SIZE]);

  const leaderboardTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(leaderboardEntries.length / LEADERBOARD_PAGE_SIZE));
  }, [leaderboardEntries, LEADERBOARD_PAGE_SIZE]);

  const rankPresentation = getRankPresentation(walletRank);
  const toggleClasses = ['wallet-checker__toggle'];
  if (hasWallet && !isOpen) {
    toggleClasses.push('wallet-checker__toggle--wallet');
  }
  const toggleLabel = hasWallet && !isOpen ? shortenAddress(walletAddress ?? '') : 'Wallet Checker';
  const handleWalletToggle = () => {
    setIsLeaderboardOpen(false);
    setIsOpen((previous) => !previous);
  };

  return (
    <div className={rootClasses.join(' ')}>
      <button type="button" className={toggleClasses.join(' ')} onClick={handleWalletToggle}>
        <span>{toggleLabel}</span>
        <span className={`wallet-checker__indicator wallet-checker__indicator--${walletStatus}`} />
      </button>
      <div className={`wallet-checker__panel ${isOpen ? 'wallet-checker__panel--visible' : ''}`}>
        <header className="wallet-checker__header">
          <div>
            <p className="wallet-checker__eyebrow">MegaETH activity radar</p>
            <h2>Wallet Checker</h2>
          </div>
          <button
            type="button"
            className="wallet-checker__close"
            aria-label="Close wallet checker"
            onClick={() => setIsOpen(false)}
          >
            &times;
          </button>
        </header>
        <form className="wallet-checker__form" onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="text"
            placeholder="0x..."
            value={walletInput}
            onChange={(event) => setWalletInput(event.target.value)}
            aria-label="MegaETH address"
          />
          <button type="submit" className="wallet-checker__submit" disabled={isBusy}>
            {walletStatus === 'loading' ? 'Scanning...' : 'Scan wallet'}
          </button>
          {hasWallet ? (
            <button type="button" className="wallet-checker__ghost" onClick={handleClearWallet}>
              Clear
            </button>
          ) : null}
        </form>
        <div className="wallet-checker__status">
          {isBusy ? (
            <div className="wallet-checker__loading">
              <span className="wallet-checker__spinner" aria-hidden="true" />
              <span>Analyzing wallet...</span>
            </div>
          ) : null}
          {walletError && !isBusy ? <p className="wallet-checker__error">{walletError}</p> : null}
          {walletUpdatedAt && walletStatus === 'ready' ? (
            <p className="wallet-checker__meta">Updated at {formatTimestamp(walletUpdatedAt)}</p>
          ) : null}
        </div>
        {contractDirectoryStatus === 'error' ? (
          <p className="wallet-checker__error">
            Unable to sync the MegaETH smart contracts. Try refreshing the page.
          </p>
        ) : null}
        {walletStatus === 'ready' && !hasInsights ? (
          <p className="wallet-checker__hint">No MegaETH interactions were detected for this wallet.</p>
        ) : null}
        {topInteractions.length ? (
          <div className="wallet-checker__results">
            <div className="wallet-checker__results-header">
              <p>Interacted projects</p>
              {hasWallet ? (
                <button type="button" onClick={refreshWalletInsights} disabled={isBusy}>
                  Refresh
                </button>
              ) : null}
            </div>
            <ul>
              {topInteractions.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.name}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {trackedNfts.length ? (
          <div className="wallet-checker__results wallet-checker__results--nft">
            <div className="wallet-checker__results-header">
              <p>Tracked collections (NFT)</p>
            </div>
            <ul>
              {trackedNfts.map((entry) => (
                <li key={`${entry.id}-nft`}>
                  <span>{entry.name}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {hasWallet && isLeaderboardOpen ? (
        <div className="wallet-checker__leaderboard-window" role="dialog" aria-label="Avon leaderboard">
          <div className="wallet-checker__results wallet-checker__leaderboard">
            <div className="wallet-checker__results-header">
              <p>Avon leaderboard</p>
              <div className="wallet-checker__leaderboard-actions">
                <button type="button" onClick={() => void loadAvonLeaderboard()} disabled={leaderboardStatus === 'loading'}>
                  Refresh
                </button>
                <button type="button" className="wallet-checker__leaderboard-close" onClick={handleCloseLeaderboard}>
                  Close
                </button>
              </div>
            </div>

            {leaderboardStatus === 'loading' ? (
              <div className="wallet-checker__loading">
                <span className="wallet-checker__spinner" aria-hidden="true" />
                <span>Loading Avon points...</span>
              </div>
            ) : null}

            {leaderboardError && leaderboardStatus === 'error' ? (
              <p className="wallet-checker__error">{leaderboardError}</p>
            ) : null}

            {leaderboardStatus === 'ready' ? (
              <>
                <div className="wallet-checker__leaderboard-meta">
                  <span>Your rank: {walletRank ? `#${walletRank}` : 'Not ranked yet'}</span>
                  <span>
                    Your {leaderboardTokenLabel}: <strong>{walletPointsLabel ?? '0.00'}</strong>
                  </span>
                </div>
                <ul>
                  {paginatedLeaderboardEntries.map((entry) => (
                    <li
                      key={`${entry.rank}-${entry.address}`}
                      className={`wallet-checker__leaderboard-item ${
                        entry.isCurrentWallet ? 'wallet-checker__leaderboard-item--current' : ''
                      }`}
                    >
                      <span>
                        #{entry.rank} {shortenAddress(entry.address)}
                      </span>
                      <strong>{entry.pointsLabel}</strong>
                    </li>
                  ))}
                </ul>
                {leaderboardTotalPages > 1 ? (
                  <div className="wallet-checker__leaderboard-pagination">
                    <button
                      type="button"
                      onClick={() => setLeaderboardPage((previous) => Math.max(0, previous - 1))}
                      disabled={leaderboardPage === 0}
                    >
                      Prev
                    </button>
                    <span>
                      Page {leaderboardPage + 1} / {leaderboardTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLeaderboardPage((previous) => Math.min(leaderboardTotalPages - 1, previous + 1))}
                      disabled={leaderboardPage >= leaderboardTotalPages - 1}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {hasWallet ? (
        <button
          type="button"
          className={`wallet-checker__leaderboard-pill ${
            leaderboardStatus === 'error'
              ? 'wallet-checker__leaderboard-pill--error'
              : leaderboardStatus === 'loading'
                ? 'wallet-checker__leaderboard-pill--loading'
                : rankPresentation.pillClassName
          }`}
          aria-live="polite"
          onClick={handlePillClick}
        >
          <img src="/logos/Avon.webp" alt="" aria-hidden="true" className="wallet-checker__leaderboard-pill-logo" />
          <span className="wallet-checker__leaderboard-pill-text">
            Avon Rank{' '}
            {leaderboardStatus === 'loading'
              ? '#...'
              : leaderboardStatus === 'error'
                ? '#--'
                : walletRank
                  ? `#${walletRank}`
                  : '#--'}
          </span>
          {leaderboardStatus === 'ready' ? (
            <span
              className={`wallet-checker__leaderboard-insignia wallet-checker__leaderboard-insignia--trailing ${rankPresentation.insigniaClassName}`}
              aria-hidden="true"
            >
              {rankPresentation.stars > 0 ? (
                <span className="wallet-checker__leaderboard-insignia-stars">
                  {Array.from({ length: rankPresentation.stars }).map((_, index) => (
                    <span key={`star-${index}`} className="wallet-checker__leaderboard-insignia-star" />
                  ))}
                </span>
              ) : null}
              {rankPresentation.bars > 0 ? (
                <span className="wallet-checker__leaderboard-insignia-bars">
                  {Array.from({ length: rankPresentation.bars }).map((_, index) => (
                    <span key={`bar-${index}`} className="wallet-checker__leaderboard-insignia-bar" />
                  ))}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
};
