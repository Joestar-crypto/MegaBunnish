import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useConstellation } from '../state/constellation';

const formatTimestamp = (value: number) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return formatter.format(value);
};

export const WalletChecker = () => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitWallet();
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

  return (
    <div className={`wallet-checker ${isOpen ? 'wallet-checker--open' : ''}`}>
      <button type="button" className="wallet-checker__toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <span>Wallet Checker</span>
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
            <button type="button" className="wallet-checker__ghost" onClick={clearWallet}>
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
    </div>
  );
};
