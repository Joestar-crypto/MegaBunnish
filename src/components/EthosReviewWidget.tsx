import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ReviewScore } from '../utils/ethosApi';
import {
  checkEthosAuth,
  postReviewByX,
  requestEthosStorageAccess,
} from '../utils/ethosApi';

type Props = {
  projectName: string;
  twitterUsername: string;
  onClose: () => void;
};

const ETHOS_LOGIN_URL = 'https://app.ethos.network';

export function EthosReviewModal({ projectName, twitterUsername, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Auth state
  const [ethosAuthed, setEthosAuthed] = useState(false);
  const [ethosProfileId, setEthosProfileId] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

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

  /**
   * EEW auth flow (per Ethos dev team):
   * 1. GET /wallets/privy/auth-check  (credentials: 'include')
   * 2. If 401 → prompt user to log in at app.ethos.network
   * 3. User logs in on Ethos, enables EEW → cookies now exist
   * 4. User clicks "Check again" → auth-check succeeds
   * 5. POST /wallets/privy/post/review/by-x  (credentials: 'include')
   */
  const runAuthCheck = useCallback(async () => {
    setAuthChecking(true);
    setToast(null);
    try {
      // Request storage access so the browser sends .ethos.network cookies cross-site.
      // This is needed for Brave, Safari, and Chrome with third-party cookie blocking.
      await requestEthosStorageAccess();

      const check = await checkEthosAuth();
      console.log('[Ethos] auth-check result:', check);
      setEthosAuthed(check.ok);
      setEthosProfileId(check.profileId ?? null);
      if (!check.ok) {
        setToast({
          type: 'err',
          msg: 'Not logged in on Ethos. Please log in first, then click "Check again".',
        });
      }
    } catch (err) {
      console.error('[Ethos] Auth check error:', err);
      setEthosAuthed(false);
      setToast({ type: 'err', msg: 'Could not reach Ethos. Please try again.' });
    } finally {
      setAuthChecking(false);
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    runAuthCheck();
  }, [runAuthCheck]);

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

  const notLoggedInSection = (
    <div className="ethos-review-modal__login">
      <p style={{ marginBottom: '0.5em', color: '#9da2c9' }}>
        Leave a review for <strong style={{ color: '#f4f6ff' }}>@{twitterUsername}</strong> on Ethos Network.
      </p>
      <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '12px' }}>
        You need to be logged in on Ethos with Everywhere Wallet enabled.
      </p>
      <a
        href={ETHOS_LOGIN_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="ethos-review-modal__login-btn"
        style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
      >
        Log in on Ethos ↗
      </a>
      <button
        type="button"
        className="ethos-review-modal__login-btn"
        onClick={runAuthCheck}
        style={{ marginTop: 8, background: 'transparent', border: '1px solid #444' }}
      >
        Check again
      </button>
      <p style={{ fontSize: '0.68rem', color: '#555', marginTop: 10, lineHeight: 1.4 }}>
        Using Brave? You may need to lower Shields on this site (click the lion icon → Shields Down) so Ethos cookies can be sent.
      </p>
    </div>
  );

  const authCheckingSection = (
    <div className="ethos-review-modal__form">
      <p style={{ color: '#9da2c9', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
        Checking Ethos session…
      </p>
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
  if (authChecking) {
    bodyContent = authCheckingSection;
  } else if (!ethosAuthed) {
    bodyContent = notLoggedInSection;
  } else {
    bodyContent = reviewFormSection;
  }

  const modal = (
    <div className="ethos-review-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="ethos-review-modal" role="dialog" aria-label={`Review ${projectName} on Ethos`}>
        <div className="ethos-review-modal__header">
          <h3>Review <strong>{projectName}</strong></h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
