import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { BrowserProvider } from 'ethers';
import type { ReviewScore } from '../utils/ethosApi';
import {
  connectWallet,
  getUserByAddress,
  createApiKey,
  revokeApiKey,
  postReviewByX,
} from '../utils/ethosApi';

type Props = {
  projectName: string;
  twitterUsername: string;
  onClose: () => void;
};

export function EthosReviewModal({ projectName, twitterUsername, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletProvider, setWalletProvider] = useState<BrowserProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ethosProfile, setEthosProfile] = useState<{ profileId: number; displayName: string } | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  // Review form
  const [score, setScore] = useState<ReviewScore | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const ethosProfileUrl = `https://www.ethos.network/profile/x/${encodeURIComponent(twitterUsername)}`;

  // Close handlers
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // After wallet connection, check Ethos profile
  useEffect(() => {
    if (!walletAddress || profileChecked) return;
    let cancelled = false;

    getUserByAddress(walletAddress).then((profile) => {
      if (!cancelled) {
        setEthosProfile(profile);
        setProfileChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, [walletAddress, profileChecked]);

  // Connect wallet
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setToast(null);
    try {
      const { address, provider } = await connectWallet();
      setWalletAddress(address);
      setWalletProvider(provider);
      setProfileChecked(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'err', msg });
    } finally {
      setConnecting(false);
    }
  }, []);

  // Submit review: sign SIWE → create API key → post review → revoke key
  const handleSubmit = useCallback(async () => {
    if (!score || !title.trim() || !walletAddress || !walletProvider) return;
    setSubmitting(true);
    setToast(null);

    let keyId: string | null = null;
    let apiKeyToken: string | null = null;

    try {
      // 1. Create ephemeral API key (triggers MetaMask signature)
      const key = await createApiKey(walletProvider, walletAddress);
      keyId = key.id;
      apiKeyToken = key.token;

      // 2. Post review
      const result = await postReviewByX(apiKeyToken, twitterUsername, score, title, content);
      const viewUrl = result.reviewSlug ? `ethos.network/review/${result.reviewSlug}` : '';
      setToast({ type: 'ok', msg: `Review posted!${viewUrl ? ` View: ${viewUrl}` : ''}` });
      setScore(null);
      setTitle('');
      setContent('');
      setTimeout(() => onClose(), 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setToast({ type: 'err', msg });
    } finally {
      // 3. Revoke API key (best-effort)
      if (keyId && apiKeyToken) {
        revokeApiKey(keyId, apiKeyToken);
      }
      setSubmitting(false);
    }
  }, [score, title, content, twitterUsername, walletAddress, walletProvider, onClose]);

  // ── Render sections ───────────────────────────────────────────

  const connectSection = (
    <div className="ethos-review-modal__login">
      <p style={{ marginBottom: '0.5em', color: '#9da2c9' }}>
        Leave a review for <strong style={{ color: '#f4f6ff' }}>@{twitterUsername}</strong> on Ethos Network.
      </p>
      <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '12px' }}>
        Connect a wallet linked to your Ethos profile to submit reviews.
      </p>
      <button
        type="button"
        className="ethos-review-modal__login-btn"
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    </div>
  );

  const noProfileSection = (
    <div className="ethos-review-modal__form">
      <div className="ethos-review-modal__sub">
        Wallet: {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}
      </div>
      <p style={{ color: '#c84', fontSize: '0.85rem', margin: '16px 0 8px' }}>
        This wallet is not linked to any Ethos profile.
      </p>
      <p style={{ color: '#666', fontSize: '0.75rem', marginBottom: '16px' }}>
        Link this wallet on <a href="https://app.ethos.network" target="_blank" rel="noreferrer noopener" style={{ color: '#7a8cff' }}>app.ethos.network</a>,
        or connect a different wallet.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="ethos-review-modal__login-btn"
          onClick={handleConnect}
          disabled={connecting}
          style={{ flex: 1 }}
        >
          {connecting ? 'Connecting…' : 'Try Another Wallet'}
        </button>
      </div>
    </div>
  );

  const reviewFormSection = (
    <div className="ethos-review-modal__form">
      <div className="ethos-review-modal__sub">
        Reviewing <a href={ethosProfileUrl} target="_blank" rel="noreferrer noopener">@{twitterUsername}</a>
        <span> · {ethosProfile?.displayName ?? walletAddress?.slice(0, 6) + '…' + walletAddress?.slice(-4)}</span>
      </div>

      {/* Score selector */}
      <div className="ethos-review-modal__scores">
        {(['positive', 'neutral', 'negative'] as ReviewScore[]).map((s) => (
          <button
            key={s}
            type="button"
            className={[
              'ethos-review-modal__score-btn',
              `ethos-review-modal__score-btn--${s}`,
              score === s ? `ethos-review-modal__score-btn--active ethos-review-modal__score-btn--${s}` : '',
            ].join(' ')}
            onClick={() => setScore(s)}
          >
            {s === 'positive' ? '👍 Positive' : s === 'neutral' ? '😐 Neutral' : '👎 Negative'}
          </button>
        ))}
      </div>

      <input
        className="ethos-review-modal__input"
        type="text"
        placeholder="Review title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />

      <textarea
        className="ethos-review-modal__textarea"
        placeholder="Your review (optional)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
      />

      <div className="ethos-review-modal__actions">
        <button type="button" className="ethos-review-modal__cancel-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="ethos-review-modal__submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !score || !title.trim()}
        >
          {submitting ? 'Signing & submitting…' : 'Submit Review'}
        </button>
      </div>

      <p style={{ fontSize: '0.65rem', color: '#555', marginTop: 8, textAlign: 'center' }}>
        Your wallet will sign a message to authenticate with Ethos.
      </p>
    </div>
  );

  const checkingSection = (
    <div className="ethos-review-modal__form">
      <div className="ethos-review-modal__sub">
        Wallet: {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}
      </div>
      <p style={{ color: '#9da2c9', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
        Checking Ethos profile…
      </p>
    </div>
  );

  let bodyContent: React.ReactNode;
  if (!walletAddress) {
    bodyContent = connectSection;
  } else if (!profileChecked) {
    bodyContent = checkingSection;
  } else if (!ethosProfile) {
    bodyContent = noProfileSection;
  } else {
    bodyContent = reviewFormSection;
  }

  const modal = (
    <div className="ethos-review-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="ethos-review-modal" role="dialog" aria-label={`Review ${projectName} on Ethos`}>
        <div className="ethos-review-modal__header">
          <h3>Review <strong>{projectName}</strong></h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {walletAddress && (
              <button
                type="button"
                onClick={() => {
                  setWalletAddress(null);
                  setWalletProvider(null);
                  setEthosProfile(null);
                  setProfileChecked(false);
                }}
                style={{
                  background: 'none', border: '1px solid #444', borderRadius: 6,
                  color: '#888', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            )}
            <button type="button" className="ethos-review-modal__close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        {toast && (
          <div className={`ethos-review-modal__toast ethos-review-modal__toast--${toast.type}`}>
            {toast.msg}
          </div>
        )}
        {bodyContent}
        <div className="ethos-review-modal__footer">
          <a href={ethosProfileUrl} target="_blank" rel="noreferrer noopener">View on Ethos ↗</a>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
