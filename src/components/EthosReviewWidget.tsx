import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePrivy, useGetAccessTokenForProvider } from '@privy-io/react-auth';
import type { ReviewScore } from '../utils/ethosApi';
import { postReviewByX, exchangePrivyToken, setPrivyToken } from '../utils/ethosApi';

const ETHOS_NETWORK_APP_ID = 'cm5l76en107pt1lpl2ve2ocfy';

type Props = {
  projectName: string;
  twitterUsername: string;
  onClose: () => void;
};

/**
 * Acquire the best available Privy token for Ethos API calls.
 * Priority: cross-app token (Ethos's Privy app) > our app's async JWT.
 */
async function acquireToken(
  getAccessTokenForProvider: (o: { appId: string }) => { token: string | null },
  getAccessToken: () => Promise<string | null>,
): Promise<{ token: string | null; source: 'cross-app' | 'app' | 'none' }> {
  // 1. Try cross-app token (sync)
  const { token: crossToken } = getAccessTokenForProvider({ appId: ETHOS_NETWORK_APP_ID });
  if (crossToken) {
    console.log('[EthosReview] Got cross-app token:', crossToken.slice(0, 20) + '…');
    return { token: crossToken, source: 'cross-app' };
  }
  // 2. Fallback to our app's JWT (async)
  const appToken = await getAccessToken();
  if (appToken) {
    console.log('[EthosReview] Using app JWT fallback:', appToken.slice(0, 20) + '…');
    return { token: appToken, source: 'app' };
  }
  console.warn('[EthosReview] No token available at all');
  return { token: null, source: 'none' };
}

export function EthosReviewModal({ projectName, twitterUsername, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { getAccessTokenForProvider } = useGetAccessTokenForProvider();

  const [score, setScore] = useState<ReviewScore | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [ethosAuthed, setEthosAuthed] = useState(false);
  const [authDebug, setAuthDebug] = useState('');

  // Check if user has Ethos cross-app linked account
  const ethosAccount = user?.linkedAccounts?.find(
    (a): a is Extract<typeof a, { type: 'cross_app' }> => a.type === 'cross_app',
  );
  const ethosWallet = ethosAccount?.embeddedWallets?.[0]?.address;
  const isEthosLinked = !!ethosWallet;

  const ethosUrl = `https://www.ethos.network/profile/x/${encodeURIComponent(twitterUsername)}`;

  // Close handlers
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // After login: acquire token and try exchange (sets session cookies via proxy)
  useEffect(() => {
    if (!ready || !authenticated || !isEthosLinked || ethosAuthed) return;
    let cancelled = false;

    (async () => {
      const { token, source } = await acquireToken(getAccessTokenForProvider, getAccessToken);

      if (!token) {
        setAuthDebug(`No token (cross-app=null, app=null). Linked: ${JSON.stringify(user?.linkedAccounts?.map(a => a.type))}`);
        if (!cancelled) setEthosAuthed(true);
        return;
      }

      setPrivyToken(token);
      setAuthDebug(`Token source: ${source} | ${token.slice(0, 25)}…`);

      // Try exchange to set HttpOnly session cookies
      try {
        await exchangePrivyToken(token);
        console.log('[EthosReview] Exchange OK via', source);
        setAuthDebug(prev => prev + ' | Exchange OK ✓');
      } catch (err) {
        console.warn('[EthosReview] Exchange failed (non-fatal, Bearer will be used directly):', err);
        setAuthDebug(prev => prev + ' | Exchange failed (will use Bearer)');
      }
      if (!cancelled) setEthosAuthed(true);
    })();

    return () => { cancelled = true; };
  }, [ready, authenticated, isEthosLinked, ethosAuthed, getAccessTokenForProvider, getAccessToken, user]);

  // Submit review
  const handleSubmit = useCallback(async () => {
    if (!score || !title.trim()) return;
    setSubmitting(true);
    setToast(null);
    try {
      // Re-acquire freshest token before submit
      const { token, source } = await acquireToken(getAccessTokenForProvider, getAccessToken);
      if (token) {
        setPrivyToken(token);
        console.log('[EthosReview] Submit with', source, 'token');
        // Try exchange to refresh session (non-blocking)
        try { await exchangePrivyToken(token); } catch { /* Bearer will work directly */ }
      } else {
        console.warn('[EthosReview] Submit: NO token available!');
      }

      const result = await postReviewByX(twitterUsername, score, title, content);
      const viewUrl = result.reviewSlug ? `ethos.network/review/${result.reviewSlug}` : '';
      setToast({ type: 'ok', msg: `Review posted!${viewUrl ? ` View: ${viewUrl}` : ''}` });
      setScore(null);
      setTitle('');
      setContent('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setToast({ type: 'err', msg });
    } finally {
      setSubmitting(false);
    }
  }, [score, title, content, twitterUsername, getAccessTokenForProvider, getAccessToken]);

  const modal = (
    <div className="ethos-review-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="ethos-review-modal" role="dialog" aria-label={`Review ${projectName} on Ethos`}>
        <div className="ethos-review-modal__header">
          <h3>Review <strong>{projectName}</strong></h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {authenticated && (
              <button
                type="button"
                onClick={() => logout()}
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

        {!authenticated ? (
          /* Not logged in — show Sign in with Ethos */
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
              onClick={() => login()}
              disabled={!ready}
            >
              Sign in with Ethos
            </button>
          </div>
        ) : !isEthosLinked ? (
          /* Logged in but no Ethos cross-app — need to re-login */
          <div className="ethos-review-modal__login">
            <p style={{ marginBottom: '0.5em', color: '#9da2c9' }}>
              Your current session doesn't include an Ethos account.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '12px' }}>
              Please sign out and sign back in with Ethos to leave reviews.
            </p>
            <button
              type="button"
              className="ethos-review-modal__login-btn"
              onClick={() => logout().then(() => login())}
              disabled={!ready}
            >
              Sign in with Ethos
            </button>
          </div>
        ) : (
          /* Authenticated with Ethos — show review form */
          <div className="ethos-review-modal__form">
            <div className="ethos-review-modal__sub">
              Reviewing <a href={ethosUrl} target="_blank" rel="noreferrer noopener">@{twitterUsername}</a>
              {ethosWallet && <span> · EEW: {ethosWallet.slice(0, 6)}…{ethosWallet.slice(-4)}</span>}
            </div>
            {authDebug && (
              <div style={{ fontSize: '0.65rem', color: '#666', padding: '4px 0', wordBreak: 'break-all' }}>
                🔑 {authDebug}
              </div>
            )}

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

            {/* Title */}
            <input
              className="ethos-review-modal__input"
              type="text"
              placeholder="Review title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />

            {/* Content */}
            <textarea
              className="ethos-review-modal__textarea"
              placeholder="Your review (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={2000}
            />

            {/* Actions */}
            <div className="ethos-review-modal__actions">
              <button type="button" className="ethos-review-modal__cancel-btn" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="ethos-review-modal__submit-btn"
                onClick={handleSubmit}
                disabled={submitting || !score || !title.trim() || !ethosAuthed}
              >
                {submitting ? 'Submitting…' : !ethosAuthed ? 'Authenticating…' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}

        <div className="ethos-review-modal__footer">
          <a href={ethosUrl} target="_blank" rel="noreferrer noopener">View on Ethos ↗</a>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
