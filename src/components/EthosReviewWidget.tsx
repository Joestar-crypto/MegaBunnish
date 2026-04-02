import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePrivy } from '@privy-io/react-auth';
import type { ReviewScore } from '../utils/ethosApi';
import {
  exchangePrivyToken,
  checkEthosAuth,
  postReviewByX,
} from '../utils/ethosApi';

type Props = {
  projectName: string;
  twitterUsername: string;
  onClose: () => void;
};

export function EthosReviewModal({ projectName, twitterUsername, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();

  // Auth state
  const [ethosAuthed, setEthosAuthed] = useState(false);
  const [ethosProfileId, setEthosProfileId] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Review form
  const [score, setScore] = useState<ReviewScore | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const ethosProfileUrl = `https://www.ethos.network/profile/x/${encodeURIComponent(twitterUsername)}`;

  // Get the EEW address from Privy cross-app linked account
  const linkedAccount = user?.linkedAccounts?.find((a) => a.type === 'cross_app');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eewAddress = (linkedAccount as any)?.embeddedWallets?.[0]?.address as string | undefined;

  // Close handlers
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // After Privy auth, exchange token for Ethos session cookies
  useEffect(() => {
    if (!authenticated || !ready || ethosAuthed) return;
    let cancelled = false;

    (async () => {
      setAuthChecking(true);
      try {
        // First check if we already have valid Ethos session cookies
        const authStatus = await checkEthosAuth();
        if (!cancelled && authStatus.ok) {
          setEthosAuthed(true);
          setEthosProfileId(authStatus.profileId ?? null);
          setAuthChecking(false);
          return;
        }

        // Exchange Privy token for Ethos session
        const token = await getAccessToken();
        if (!token) throw new Error('Could not get Privy access token.');
        await exchangePrivyToken(token);

        // Verify exchange worked
        const check = await checkEthosAuth();
        if (!cancelled) {
          if (check.ok) {
            setEthosAuthed(true);
            setEthosProfileId(check.profileId ?? null);
          } else {
            setToast({ type: 'err', msg: 'Ethos session could not be established. Make sure you have an Ethos profile with Everywhere Wallet enabled.' });
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Auth exchange failed.';
          setToast({ type: 'err', msg });
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, ready, ethosAuthed, getAccessToken]);

  // Sign in with Ethos via Privy
  const handleLogin = useCallback(async () => {
    setConnecting(true);
    setToast(null);
    try {
      login();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ type: 'err', msg });
    } finally {
      setConnecting(false);
    }
  }, [login]);

  // Submit review using Ethos session cookies
  const handleSubmit = useCallback(async () => {
    if (!score || !title.trim() || !ethosAuthed) return;
    setSubmitting(true);
    setToast(null);

    try {
      const result = await postReviewByX(twitterUsername, score, title, content);
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
      setSubmitting(false);
    }
  }, [score, title, content, twitterUsername, ethosAuthed, onClose]);

  // ── Render sections ───────────────────────────────────────────

  const loginSection = (
    <div className="ethos-review-modal__login">
      <p style={{ marginBottom: '0.5em', color: '#9da2c9' }}>
        Leave a review for <strong style={{ color: '#f4f6ff' }}>@{twitterUsername}</strong> on Ethos Network.
      </p>
      <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '12px' }}>
        Sign in with your Ethos account to submit reviews.
      </p>
      <button
        type="button"
        className="ethos-review-modal__login-btn"
        onClick={handleLogin}
        disabled={connecting || !ready}
      >
        {connecting ? 'Connecting…' : 'Sign in with Ethos'}
      </button>
    </div>
  );

  const authCheckingSection = (
    <div className="ethos-review-modal__form">
      <p style={{ color: '#9da2c9', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
        Connecting to Ethos…
      </p>
    </div>
  );

  const noProfileSection = (
    <div className="ethos-review-modal__form">
      {eewAddress && (
        <div className="ethos-review-modal__sub">
          EEW: {eewAddress.slice(0, 6)}…{eewAddress.slice(-4)}
        </div>
      )}
      <p style={{ color: '#c84', fontSize: '0.85rem', margin: '16px 0 8px' }}>
        Could not establish an Ethos session.
      </p>
      <p style={{ color: '#666', fontSize: '0.75rem', marginBottom: '16px' }}>
        Make sure you have an <a href="https://app.ethos.network" target="_blank" rel="noreferrer noopener" style={{ color: '#7a8cff' }}>Ethos profile</a> with
        Everywhere Wallet enabled, then try again.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="ethos-review-modal__login-btn"
          onClick={() => { setEthosAuthed(false); setEthosProfileId(null); setToast(null); }}
          style={{ flex: 1 }}
        >
          Retry
        </button>
      </div>
    </div>
  );

  const reviewFormSection = (
    <div className="ethos-review-modal__form">
      <div className="ethos-review-modal__sub">
        Reviewing <a href={ethosProfileUrl} target="_blank" rel="noreferrer noopener">@{twitterUsername}</a>
        {ethosProfileId && <span> · Profile #{ethosProfileId}</span>}
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
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );

  let bodyContent: React.ReactNode;
  if (!authenticated) {
    bodyContent = loginSection;
  } else if (authChecking) {
    bodyContent = authCheckingSection;
  } else if (!ethosAuthed) {
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
            {authenticated && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setEthosAuthed(false);
                  setEthosProfileId(null);
                }}
                style={{
                  background: 'none', border: '1px solid #444', borderRadius: 6,
                  color: '#888', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
                }}
              >
                Sign out
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
