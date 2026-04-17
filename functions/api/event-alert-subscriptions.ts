import { Redis } from '@upstash/redis';

type Env = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  EVENT_ALERTS_STORAGE_KEY?: string;
  EVENT_ALERTS_ADMIN_SECRET?: string;
  EVENT_ALERTS_CRON_SECRET?: string;
  EVENT_ALERTS_UNSUBSCRIBE_SECRET?: string;
  RESEND_API_KEY?: string;
};

type EventAlertSubscriber = {
  email: string;
  status: 'subscribed' | 'unsubscribed';
  source: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
  updatedAt: string;
};

type EventAlertDelivery = {
  eventId: string;
  subject: string;
  deliveredEmails: string[];
  resendEmailIds: string[];
  lastAttemptAt: string | null;
  lastDeliveredAt: string | null;
  lastFailedEmails: string[];
  lastAttemptedCount: number;
  lastSentCount: number;
  lastFailedCount: number;
  createdAt: string;
  updatedAt: string;
};

type EventAlertsStoreData = {
  version: 1;
  subscribers: EventAlertSubscriber[];
  deliveries: EventAlertDelivery[];
};

type FunctionContext = {
  request: Request;
  env: Env;
};

const DEFAULT_STORAGE_KEY = 'megabunnish:event-alerts';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEventAlertEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function createEmptyStoreData(): EventAlertsStoreData {
  return {
    version: 1,
    subscribers: [],
    deliveries: []
  };
}

function sortStoreData(data: EventAlertsStoreData) {
  data.subscribers.sort((left, right) => left.email.localeCompare(right.email));
  data.deliveries.sort((left, right) => left.eventId.localeCompare(right.eventId));
  return data;
}

function normalizeSubscriberRecord(record: Partial<EventAlertSubscriber> | null | undefined): EventAlertSubscriber | null {
  if (!record?.email) {
    return null;
  }

  const email = normalizeEmail(record.email);
  const subscribedAt = typeof record.subscribedAt === 'string' && record.subscribedAt ? record.subscribedAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : subscribedAt;
  const unsubscribedAt = typeof record.unsubscribedAt === 'string' && record.unsubscribedAt ? record.unsubscribedAt : null;

  return {
    email,
    status: record.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed',
    source: typeof record.source === 'string' && record.source ? record.source : 'events_panel',
    subscribedAt,
    unsubscribedAt,
    updatedAt
  };
}

function normalizeDeliveryRecord(record: Partial<EventAlertDelivery> | null | undefined): EventAlertDelivery | null {
  if (!record?.eventId) {
    return null;
  }

  const createdAt = typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : createdAt;

  return {
    eventId: record.eventId,
    subject: typeof record.subject === 'string' ? record.subject : '',
    deliveredEmails: uniqueSorted((record.deliveredEmails ?? []).map(normalizeEmail)),
    resendEmailIds: uniqueSorted((record.resendEmailIds ?? []).filter(Boolean)),
    lastAttemptAt: typeof record.lastAttemptAt === 'string' && record.lastAttemptAt ? record.lastAttemptAt : null,
    lastDeliveredAt: typeof record.lastDeliveredAt === 'string' && record.lastDeliveredAt ? record.lastDeliveredAt : null,
    lastFailedEmails: uniqueSorted((record.lastFailedEmails ?? []).map(normalizeEmail)),
    lastAttemptedCount: typeof record.lastAttemptedCount === 'number' ? record.lastAttemptedCount : 0,
    lastSentCount: typeof record.lastSentCount === 'number' ? record.lastSentCount : 0,
    lastFailedCount: typeof record.lastFailedCount === 'number' ? record.lastFailedCount : 0,
    createdAt,
    updatedAt
  };
}

function normalizeStoreData(raw: unknown): EventAlertsStoreData {
  const candidate = raw && typeof raw === 'object' ? raw as Partial<EventAlertsStoreData> : null;
  const rawSubscribers = Array.isArray(candidate?.subscribers) ? candidate.subscribers : [];
  const rawDeliveries = Array.isArray(candidate?.deliveries) ? candidate.deliveries : [];

  return sortStoreData({
    version: 1,
    subscribers: rawSubscribers
      .map((record) => normalizeSubscriberRecord(record))
      .filter((record): record is EventAlertSubscriber => Boolean(record)),
    deliveries: rawDeliveries
      .map((record) => normalizeDeliveryRecord(record))
      .filter((record): record is EventAlertDelivery => Boolean(record))
  });
}

function getStorageKey(env: Env) {
  return env.EVENT_ALERTS_STORAGE_KEY?.trim() || DEFAULT_STORAGE_KEY;
}

function getRedis(env: Env) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Event alert storage is not configured on this deployment.');
  }

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });
}

async function readStoreData(env: Env) {
  const redis = getRedis(env);
  const rawValue = await redis.get(getStorageKey(env));

  if (!rawValue) {
    return createEmptyStoreData();
  }

  if (typeof rawValue === 'string') {
    return normalizeStoreData(JSON.parse(rawValue) as unknown);
  }

  return normalizeStoreData(rawValue);
}

async function writeStoreData(env: Env, data: EventAlertsStoreData) {
  const redis = getRedis(env);
  const normalized = sortStoreData(normalizeStoreData(data));
  await redis.set(getStorageKey(env), JSON.stringify(normalized));
}

async function subscribeEventAlertSubscriber(env: Env, email: string, source = 'events_panel') {
  const data = await readStoreData(env);
  const normalizedEmail = normalizeEmail(email);
  const nowIso = new Date().toISOString();
  const existing = data.subscribers.find((subscriber) => subscriber.email === normalizedEmail);

  if (existing) {
    existing.status = 'subscribed';
    existing.source = source;
    existing.unsubscribedAt = null;
    existing.updatedAt = nowIso;
  } else {
    data.subscribers.push({
      email: normalizedEmail,
      status: 'subscribed',
      source,
      subscribedAt: nowIso,
      unsubscribedAt: null,
      updatedAt: nowIso
    });
  }

  await writeStoreData(env, data);

  return {
    email: normalizedEmail,
    activeSubscriberCount: data.subscribers.filter((subscriber) => subscriber.status === 'subscribed').length,
    storageDriver: 'upstash'
  };
}

async function unsubscribeEventAlertSubscriber(env: Env, email: string) {
  const data = await readStoreData(env);
  const normalizedEmail = normalizeEmail(email);
  const nowIso = new Date().toISOString();
  const existing = data.subscribers.find((subscriber) => subscriber.email === normalizedEmail);

  if (existing) {
    existing.status = 'unsubscribed';
    existing.unsubscribedAt = nowIso;
    existing.updatedAt = nowIso;
    await writeStoreData(env, data);
  }

  return {
    email: normalizedEmail,
    activeSubscriberCount: data.subscribers.filter((subscriber) => subscriber.status === 'subscribed').length,
    storageDriver: 'upstash'
  };
}

function readHeader(request: Request, key: string) {
  return request.headers.get(key) ?? request.headers.get(key.toLowerCase());
}

function isAdminAuthorized(request: Request, env: Env) {
  const secret = env.EVENT_ALERTS_ADMIN_SECRET ?? env.EVENT_ALERTS_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const url = new URL(request.url);
  const authorization = readHeader(request, 'authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const querySecret = url.searchParams.get('secret');
  return bearerToken === secret || querySecret === secret;
}

function jsonResponse(payload: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'GET,POST,DELETE',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'GET,POST,DELETE',
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getUnsubscribeSecret(env: Env) {
  const secret = env.EVENT_ALERTS_UNSUBSCRIBE_SECRET ?? env.EVENT_ALERTS_CRON_SECRET ?? env.RESEND_API_KEY;
  if (!secret) {
    throw new Error('Unsubscribe links are not configured on this deployment.');
  }

  return secret;
}

async function buildUnsubscribeToken(env: Env, email: string) {
  const secret = getUnsubscribeSecret(env);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(normalizeEmail(email)));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeCompare(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function verifyEventAlertUnsubscribeToken(env: Env, email: string, token: string) {
  const expected = await buildUnsubscribeToken(env, email);
  return timingSafeCompare(expected, token);
}

function createConfirmationHtml(email: string, unsubscribeUrl: string) {
  const escapedEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manage event alerts</title>
  </head>
  <body style="margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <div style="background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;">
        <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Megabunnish Event Alerts</div>
        <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.1;">Unsubscribe ${escapedEmail}?</h1>
        <p style="margin:0 0 20px;color:rgba(255,244,214,0.78);line-height:1.6;">If you confirm, this email address will stop receiving new MegaETH ecosystem event announcements.</p>
        <a href="${escapeHtml(unsubscribeUrl)}" style="display:inline-block;background:#f5c84c;color:#1b1206;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px;">Confirm unsubscribe</a>
      </div>
    </div>
  </body>
</html>`;
}

function createUnsubscribedHtml(email: string) {
  const escapedEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribed</title>
  </head>
  <body style="margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <div style="background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;">
        <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Megabunnish Event Alerts</div>
        <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.1;">Unsubscribed</h1>
        <p style="margin:0;color:rgba(255,244,214,0.78);line-height:1.6;">${escapedEmail} will no longer receive new MegaETH ecosystem event announcements.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function parseJsonBody(request: Request) {
  const rawBody = await request.text();
  if (!rawBody) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

async function handleGet(context: FunctionContext) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const action = url.searchParams.get('action') ?? '';

  if (email && token) {
    if (!isValidEventAlertEmail(email)) {
      return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
    }

    const isValidToken = await verifyEventAlertUnsubscribeToken(env, email, token);
    if (!isValidToken) {
      return jsonResponse({ error: 'Invalid unsubscribe link.' }, 401);
    }

    if (action === 'unsubscribe') {
      await unsubscribeEventAlertSubscriber(env, email);
      return htmlResponse(createUnsubscribedHtml(email));
    }

    const unsubscribeUrl = `${url.origin}/api/event-alert-subscriptions?email=${encodeURIComponent(normalizeEmail(email))}&token=${encodeURIComponent(token)}&action=unsubscribe`;
    return htmlResponse(createConfirmationHtml(email, unsubscribeUrl));
  }

  if (!isAdminAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const snapshot = await readStoreData(env);
  const activeSubscribers = snapshot.subscribers.filter((subscriber) => subscriber.status === 'subscribed');

  return jsonResponse({
    ok: true,
    storageDriver: 'upstash',
    activeSubscriberCount: activeSubscribers.length,
    subscribers: snapshot.subscribers,
    deliveries: snapshot.deliveries
  });
}

async function handleMutation(context: FunctionContext, method: 'POST' | 'DELETE') {
  const { request, env } = context;
  const url = new URL(request.url);
  const payload = await parseJsonBody(request);
  const emailFromBody = typeof payload.email === 'string' ? payload.email : '';
  const email = emailFromBody || url.searchParams.get('email') || '';

  if (!isValidEventAlertEmail(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
  }

  const result = method === 'POST'
    ? await subscribeEventAlertSubscriber(env, email)
    : await unsubscribeEventAlertSubscriber(env, email);

  return jsonResponse({ ok: true, ...result });
}

export async function onRequestGet(context: FunctionContext) {
  try {
    return await handleGet(context);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500);
  }
}

export async function onRequestPost(context: FunctionContext) {
  try {
    return await handleMutation(context, 'POST');
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500);
  }
}

export async function onRequestDelete(context: FunctionContext) {
  try {
    return await handleMutation(context, 'DELETE');
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'GET,POST,DELETE,OPTIONS'
    }
  });
}