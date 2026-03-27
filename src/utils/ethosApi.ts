const ETHOS_API_BASE = import.meta.env.DEV
  ? '/ethos-api'
  : 'https://api.ethos.network/api/v2';
const ETHOS_CLIENT = 'megabunnish@1.0.0';

/* ── Token-based auth (cross-app Privy JWT + session cookies via proxy) ── */
let _privyToken: string | null = null;

export function setPrivyToken(token: string) {
  _privyToken = token;
}

const baseHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Ethos-Client': ETHOS_CLIENT,
});

const authedHeaders = (): HeadersInit => ({
  ...baseHeaders(),
  ...(_privyToken ? { Authorization: `Bearer ${_privyToken}` } : {}),
});

/* ── Auth ─────────────────────────────────────────────────────────── */

export async function exchangePrivyToken(privyToken: string) {
  _privyToken = privyToken;
  console.log('[EthosAPI] Exchanging token, first 20 chars:', privyToken.slice(0, 20) + '…');
  const res = await fetch(`${ETHOS_API_BASE}/auth/exchange`, {
    method: 'POST',
    headers: { ...baseHeaders(), Authorization: `Bearer ${privyToken}` },
    credentials: 'include',
  });
  const text = await res.text();
  console.log('[EthosAPI] Exchange response:', res.status, text.slice(0, 200));
  if (!res.ok) throw new Error(`Failed to exchange Privy token (${res.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text) as { ok: boolean };
}

export async function checkWalletAuth() {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/auth-check`, {
    method: 'GET',
    headers: authedHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ ok: boolean; profileId: number }>;
}

/* ── User lookup ─────────────────────────────────────────────────── */

export async function getUserByEthosEverywhereWallet(address: string) {
  const res = await fetch(
    `${ETHOS_API_BASE}/user/by/ethos-everywhere-wallet/${encodeURIComponent(address)}`,
    { headers: baseHeaders() },
  );
  if (!res.ok) return null;
  return res.json();
}

/* ── Reviews: read ───────────────────────────────────────────────── */

export type EthosReview = {
  id: number;
  author: { displayName: string; username: string | null; avatarUrl: string; score: number };
  score: 'positive' | 'neutral' | 'negative';
  comment: string;
  createdAt: number;
  subject: { displayName: string };
};

export type ReviewsResponse = {
  values: EthosReview[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchReceivedReviews(
  userkey: string,
  limit = 20,
  offset = 0,
): Promise<ReviewsResponse> {
  const res = await fetch(`${ETHOS_API_BASE}/activities/profile/received`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({
      userkey,
      filter: ['review'],
      limit,
      offset,
      orderBy: { field: 'timestamp', direction: 'desc' },
    }),
  });
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

/* ── Reviews: write ──────────────────────────────────────────────── */

export type ReviewScore = 'positive' | 'neutral' | 'negative';

export async function postReviewByAddress(
  address: string,
  score: ReviewScore,
  title: string,
  content?: string,
) {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/post/review/by-address`, {
    method: 'POST',
    headers: authedHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      address,
      score,
      title,
      content,
      waitForReviewTimeoutSeconds: 5,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to post review' }));
    throw new Error(err.message ?? 'Failed to post review');
  }
  return res.json() as Promise<{
    hash: string;
    review?: { id: number };
    reviewSlug?: string;
  }>;
}

export async function postReviewByX(
  username: string,
  score: ReviewScore,
  title: string,
  content?: string,
) {
  const body = {
    x: { username },
    score,
    title,
    content,
    waitForReviewTimeoutSeconds: 5,
  };
  console.log('[EthosAPI] POST review/by-x →', JSON.stringify(body));
  console.log('[EthosAPI] Headers:', JSON.stringify(authedHeaders()));

  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/post/review/by-x`, {
    method: 'POST',
    headers: authedHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log('[EthosAPI] Response status:', res.status, '| body:', text);

  if (!res.ok) {
    let errMsg = `Ethos API error (${res.status})`;
    try {
      const errData = JSON.parse(text);
      errMsg = errData.message || errData.error || errData.detail || JSON.stringify(errData);
    } catch { /* not JSON */ errMsg += ': ' + text.slice(0, 200); }
    throw new Error(errMsg);
  }
  return JSON.parse(text) as {
    hash: string;
    review?: { id: number };
    reviewSlug?: string;
  };
}

export async function checkFunds() {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/check-funds`, {
    method: 'GET',
    headers: authedHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ balance: number; sponsorshipEligible: boolean }>;
}
