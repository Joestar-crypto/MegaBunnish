import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useConstellation } from '../state/constellation';
import { NFT_CONTRACT_MAP } from '../data/contractDirectory';

const NFT_PROJECT_ALIASES: Record<string, string> = {
  badbunnz: 'bad-bunnz',
  'bad bunnz': 'bad-bunnz',
  digitrabbits: 'digitrabbits',
  'digit rabbits': 'digitrabbits',
  meganame: 'dotmegadomains',
  'mega name': 'dotmegadomains',
  megadomains: 'dotmegadomains',
  'mega domains': 'dotmegadomains',
  'mega domain': 'dotmegadomains',
  '.mega': 'dotmegadomains',
  dotmega: 'dotmegadomains',
  'dotmega domains': 'dotmegadomains',
  'world computer netizens': 'netizens',
  netizens: 'netizens',
  megalio: 'megalio',
  meganacci: 'meganacci',
  fluffle: 'fluffle',
  odds: 'odds',
  megapunks: 'mega-punk',
  'mega punks': 'mega-punk',
  'mega punk': 'mega-punk'
};


const shortenAddress = (value: string) => {
  if (!value) {
    return '';
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const formatTimestamp = (value: number) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return formatter.format(value);
};

type WalletCheckerProps = {
  isInteracting?: boolean;
};

export const WalletChecker = ({ isInteracting = false }: WalletCheckerProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isNftGalleryOpen, setIsNftGalleryOpen] = useState(false);
  const {
    walletAddress,
    walletInput,
    walletStatus,
    walletError,
    walletUpdatedAt,
    walletTransactionCount,
    walletUniqueContractCount,
    walletDiscoveredApps,
    walletDexProtocols,
    walletLpPositions,
    walletNftCollections,
    walletNftAssets,
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
    if (!isOpen && !isNftGalleryOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      const root = rootRef.current;
      if (root && !root.contains(target)) {
        setIsOpen(false);
        setIsNftGalleryOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, isNftGalleryOpen]);

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
  const hasInsights =
    walletDiscoveredApps.length > 0 ||
    walletDexProtocols.length > 0 ||
    walletLpPositions.length > 0 ||
    walletNftCollections.length > 0 ||
    topInteractions.length > 0 ||
    trackedNfts.length > 0;
  const summaryApps = useMemo(
    () => walletDiscoveredApps.slice(0, 4).map((entry) => entry.label),
    [walletDiscoveredApps]
  );
  const summaryDex = useMemo(
    () => walletDexProtocols.slice(0, 2).map((entry) => entry.label),
    [walletDexProtocols]
  );
  const summaryLp = useMemo(
    () => walletLpPositions.slice(0, 2).map((entry) => entry.symbol || entry.name),
    [walletLpPositions]
  );
  const summaryNft = useMemo(
    () => walletNftCollections.slice(0, 2).map((entry) => entry.name),
    [walletNftCollections]
  );
  const megaEthNftCollections = useMemo(() => walletNftCollections, [walletNftCollections]);
  const nftDisplayCollections = useMemo(
    () =>
      megaEthNftCollections.map((entry) => {
        const contractAddress = entry.contractAddress.toLowerCase();
        const byContract = NFT_CONTRACT_MAP[contractAddress];

        const nameKey = entry.name.toLowerCase().trim();
        const symbolKey = entry.symbol.toLowerCase().trim();
        const aliasFromName = NFT_PROJECT_ALIASES[nameKey];
        const aliasFromSymbol = NFT_PROJECT_ALIASES[symbolKey];
        const normalizedNameId = nameKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        const candidateProjectIds = [
          byContract,
          aliasFromName,
          aliasFromSymbol,
          normalizedNameId
        ].filter(Boolean) as string[];

        const projectLogo = candidateProjectIds
          .map((projectId) => resolveProjectById(projectId)?.logo)
          .find(Boolean);

        return {
          ...entry,
          displayImageUrl: projectLogo || entry.imageUrl || undefined
        };
      }),
    [megaEthNftCollections, resolveProjectById]
  );
  const nftPreviewCollections = useMemo(
    () => nftDisplayCollections.slice(0, 3),
    [nftDisplayCollections]
  );
  const nftGalleryAssets = useMemo(
    () => walletNftAssets.map((asset) => ({ ...asset, displayImageUrl: asset.imageUrl })),
    [walletNftAssets]
  );
  const nftCollectionFallbackImageByContract = useMemo(() => {
    return new Map(
      nftDisplayCollections.map((entry) => [entry.contractAddress.toLowerCase(), entry.displayImageUrl])
    );
  }, [nftDisplayCollections]);
  const nftGalleryTotal = nftGalleryAssets.length;
  const nftCollectionRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        contractAddress: string;
        collectionName: string;
        count: number;
        imageSlots: Array<{ tokenId: string; imageUrl?: string }>;
      }
    >();

    nftGalleryAssets.forEach((asset) => {
      const key = `${asset.contractAddress}:${asset.collectionName.toLowerCase()}`;
      const current = grouped.get(key) ?? {
        contractAddress: asset.contractAddress,
        collectionName: asset.collectionName,
        count: 0,
        imageSlots: []
      };
      current.count += 1;
      const fallbackImage = nftCollectionFallbackImageByContract.get(asset.contractAddress.toLowerCase());
      current.imageSlots.push({
        tokenId: asset.tokenId,
        imageUrl: asset.displayImageUrl || fallbackImage
      });
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.count - a.count || a.collectionName.localeCompare(b.collectionName)
    );
  }, [nftGalleryAssets, nftCollectionFallbackImageByContract]);

  const handleClearWallet = () => {
    clearWallet();
  };

  const rootClasses = ['wallet-checker'];
  if (isOpen) {
    rootClasses.push('wallet-checker--open');
  }
  if (isInteracting) {
    rootClasses.push('ui-panel--hidden');
  }
  const toggleClasses = ['wallet-checker__toggle'];
  if (hasWallet && !isOpen) {
    toggleClasses.push('wallet-checker__toggle--wallet');
  }
  const toggleLabel = hasWallet && !isOpen ? shortenAddress(walletAddress ?? '') : 'Wallet Checker';
  const handleWalletToggle = () => {
    setIsOpen((previous) => !previous);
  };

  return (
    <div ref={rootRef} className={rootClasses.join(' ')}>
      <div className="wallet-checker__toggle-row">
        {nftPreviewCollections.length ? (
          <button
            type="button"
            className="wallet-checker__toggle-nft-showcase"
            aria-label="Open MegaETH NFT library"
            onClick={() => setIsNftGalleryOpen(true)}
          >
            {nftPreviewCollections.map((entry) => (
              entry.displayImageUrl ? (
                <img
                  key={`nft-preview-toggle-${entry.contractAddress}`}
                  src={entry.displayImageUrl}
                  alt=""
                  className="wallet-checker__toggle-nft-item"
                />
              ) : (
                <span
                  key={`nft-preview-toggle-${entry.contractAddress}`}
                  className="wallet-checker__toggle-nft-item wallet-checker__toggle-nft-item--placeholder"
                  aria-hidden="true"
                />
              )
            ))}
          </button>
        ) : null}
        <button type="button" className={toggleClasses.join(' ')} onClick={handleWalletToggle}>
          <span>{toggleLabel}</span>
          <span className={`wallet-checker__indicator wallet-checker__indicator--${walletStatus}`} />
        </button>
      </div>
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
          {walletStatus === 'ready' ? (
            <p className="wallet-checker__meta">Transactions detected: {walletTransactionCount}</p>
          ) : null}
        </div>
        {contractDirectoryStatus === 'error' ? (
          <p className="wallet-checker__error">
            Unable to sync the MegaETH smart contracts. Try refreshing the page.
          </p>
        ) : null}
        {walletStatus === 'ready' && !hasInsights ? (
          <p className="wallet-checker__hint">
            {walletTransactionCount > 0
              ? `${walletTransactionCount} transactions detected, but none matched the tracked contract list yet.`
              : 'No MegaETH interactions were detected for this wallet.'}
          </p>
        ) : null}
        {walletStatus === 'ready' ? (
          <div className="wallet-checker__results wallet-checker__results--summary">
            <div className="wallet-checker__results-header">
              <p>Activity summary</p>
              {hasWallet ? (
                <button type="button" onClick={refreshWalletInsights} disabled={isBusy}>
                  Refresh
                </button>
              ) : null}
            </div>
            <ul>
              <li>
                <span>Scope</span>
                <strong>{walletTransactionCount} tx • {walletUniqueContractCount} contracts</strong>
              </li>
              <li>
                <span>Main apps</span>
                <strong>{summaryApps.length ? summaryApps.join(', ') : 'Not identified yet'}</strong>
              </li>
              <li>
                <span>DEX</span>
                <strong>{summaryDex.length ? summaryDex.join(', ') : 'None detected'}</strong>
              </li>
              <li>
                <span>LP</span>
                <strong>{summaryLp.length ? summaryLp.join(', ') : 'None detected'}</strong>
              </li>
              <li>
                <span>NFT</span>
                <strong>{summaryNft.length ? summaryNft.join(', ') : 'None detected'}</strong>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
      {hasWallet && isNftGalleryOpen ? (
        <div className="wallet-checker__nft-window" role="dialog" aria-label="MegaETH NFT collections">
          <div className="wallet-checker__results wallet-checker__leaderboard">
            <div className="wallet-checker__results-header">
              <p className="wallet-checker__nft-title">MegaETH NFTs ({nftGalleryTotal})</p>
              <button type="button" className="wallet-checker__leaderboard-close" onClick={() => setIsNftGalleryOpen(false)}>
                Close
              </button>
            </div>
            {nftGalleryAssets.length ? (
              <ul className="wallet-checker__nft-collection-list">
                {nftCollectionRows.map((entry) => (
                  <li key={`nft-gallery-collection-${entry.contractAddress}-${entry.collectionName}`}>
                    <div className="wallet-checker__nft-collection-cards" aria-hidden="true">
                      {entry.imageSlots.length ? (
                        entry.imageSlots.slice(0, 8).map((slot, index) => (
                          slot.imageUrl ? (
                            <img
                              key={`${entry.contractAddress}-${slot.tokenId}-${index}`}
                              src={slot.imageUrl}
                              alt=""
                              className="wallet-checker__nft-grid-image"
                            />
                          ) : (
                            <div
                              key={`${entry.contractAddress}-${slot.tokenId}-${index}`}
                              className="wallet-checker__nft-grid-image wallet-checker__nft-grid-image--placeholder"
                            />
                          )
                        ))
                      ) : (
                        <div className="wallet-checker__nft-grid-image wallet-checker__nft-grid-image--placeholder" />
                      )}
                    </div>
                    <div className="wallet-checker__nft-collection-meta">
                      <span>{entry.collectionName}</span>
                      <strong>x{entry.count}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            ) : nftDisplayCollections.length ? (
              <ul className="wallet-checker__nft-grid">
                {nftDisplayCollections.map((entry) => (
                  <li key={`nft-gallery-${entry.contractAddress}`}>
                    {entry.displayImageUrl ? (
                      <img src={entry.displayImageUrl} alt="" className="wallet-checker__nft-grid-image" />
                    ) : (
                      <div className="wallet-checker__nft-grid-image wallet-checker__nft-grid-image--placeholder" />
                    )}
                    <span>{entry.name}</span>
                    <strong>x{entry.balance}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wallet-checker__hint">No MegaETH NFT collections found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
