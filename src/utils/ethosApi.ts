import { BrowserProvider } from 'ethers';

const ETHOS_API_BASE = import.meta.env.DEV
  ? '/ethos-api'
  : 'https://api.ethos.network/api/v2';
const ETHOS_CLIENT = 'megabunnish@1.0.0';

const baseHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Ethos-Client': ETHOS_CLIENT,
});

const apiKeyHeaders = (apiKeyToken: string): HeadersInit => ({
  ...baseHeaders(),
  'X-Ethos-Api-Key': apiKeyToken,
});

/* ── Wallet connection (MetaMask / injected) ─────────────────────── */

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

/** Connect to injected wallet (MetaMask etc.) and return signer address */
export async function connectWallet(): Promise<{ address: string; provider: BrowserProvider }> {
  if (!window.ethereum) {
    throw new Error('No wallet found. Install MetaMask or another Web3 wallet.');
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { address, provider };
}

/* ── User lookup ─────────────────────────────────────────────────── */

export async function getUserByAddress(address: string) {
  const res = await fetch(`${ETHOS_API_BASE}/users/by/address`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ addresses: [address] }),
  });
  if (!res.ok) return null;
  const users = (await res.json()) as Array<{ profileId: number | null; displayName: string; score: number }>;
  if (!users.length || users[0].profileId == null) return null;
  return users[0] as { profileId: number; displayName: string; score: number };
}

/* ── SIWE API Key flow ───────────────────────────────────────────── */

function buildSiweMessage(address: string): string {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const now = new Date();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  return [
    `api.ethos.network wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Create Ethos API key',
    '',
    `URI: https://api.ethos.network`,
    `Version: 1`,
    `Chain ID: 8453`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${expiry.toISOString()}`,
  ].join('\n');
}

export async function createApiKey(
  provider: BrowserProvider,
  address: string,
): Promise<{ id: string; token: string }> {
  const message = buildSiweMessage(address);
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(message);

  const res = await fetch(`${ETHOS_API_BASE}/api-keys`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({
      address,
      message,
      signature,
      name: ETHOS_CLIENT,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `API key creation failed (${res.status})` }));
    throw new Error(err.message || `API key creation failed (${res.status})`);
  }
  return res.json() as Promise<{ id: string; token: string }>;
}

export async function revokeApiKey(keyId: string, apiKeyToken: string): Promise<void> {
  await fetch(`${ETHOS_API_BASE}/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
    headers: apiKeyHeaders(apiKeyToken),
  }).catch(() => { /* best-effort revocation */ });
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

/* ── Reviews: write (via API key) ─────────────────────────────────── */

export type ReviewScore = 'positive' | 'neutral' | 'negative';

export async function postReviewByAddress(
  apiKeyToken: string,
  address: string,
  score: ReviewScore,
  title: string,
  content?: string,
) {
  const body: Record<string, unknown> = {
    address,
    score,
    title,
    waitForTxTimeoutSeconds: 5,
  };
  if (content && content.trim()) {
    body.content = content;
  }
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/post/review/by-address`, {
    method: 'POST',
    headers: apiKeyHeaders(apiKeyToken),
    body: JSON.stringify(body),
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
  apiKeyToken: string,
  username: string,
  score: ReviewScore,
  title: string,
  content?: string,
) {
  const body: Record<string, unknown> = {
    x: { username },
    score,
    title,
    waitForTxTimeoutSeconds: 5,
  };
  if (content && content.trim()) {
    body.content = content;
  }

  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/post/review/by-x`, {
    method: 'POST',
    headers: apiKeyHeaders(apiKeyToken),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `Ethos API error (${res.status})`;
    try {
      const errData = JSON.parse(text);
      errMsg = errData.message || errData.error || errData.detail || JSON.stringify(errData);
    } catch { errMsg += ': ' + text.slice(0, 200); }
    throw new Error(errMsg);
  }
  return JSON.parse(text) as {
    hash: string;
    review?: { id: number };
    reviewSlug?: string;
  };
}

export async function checkFunds(apiKeyToken: string) {
  const res = await fetch(`${ETHOS_API_BASE}/wallets/privy/check-funds`, {
    method: 'GET',
    headers: apiKeyHeaders(apiKeyToken),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ balance: number; sponsorshipEligible: boolean }>;
}
