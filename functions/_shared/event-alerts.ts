import { Redis } from '@upstash/redis';

export type KVNamespaceLike = {
  get(key: string, type: 'json'): Promise<unknown | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export type EventAlertsEnv = {
  EVENT_ALERTS?: KVNamespaceLike;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  EVENT_ALERTS_STORAGE_KEY?: string;
  EVENT_ALERTS_ADMIN_SECRET?: string;
  EVENT_ALERTS_CRON_SECRET?: string;
  EVENT_ALERTS_UNSUBSCRIBE_SECRET?: string;
  EVENT_ALERTS_BASE_URL?: string;
  EVENT_ALERTS_RESEND_SEGMENT_NAME?: string;
  EVENT_ALERTS_RESEND_TOPIC_NAME?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_ADDRESS?: string;
};

export type EventAlertSubscriber = {
  email: string;
  status: 'subscribed' | 'unsubscribed';
  source: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
  updatedAt: string;
};

export type EventAlertDelivery = {
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

export type EventAlertsStoreData = {
  version: 1;
  subscribers: EventAlertSubscriber[];
  deliveries: EventAlertDelivery[];
};

type DeliveryUpdate = {
  eventId: string;
  subject: string;
  deliveredEmails: string[];
  resendEmailIds: string[];
  failedEmails: string[];
  attemptedCount: number;
};

type ResendPaginatedResponse<T> = {
  data: T[];
  has_more?: boolean;
};

type ResendContact = {
  id: string;
  email: string;
  created_at: string;
  unsubscribed: boolean;
};

type ResendSegment = {
  id: string;
  name: string;
};

type ResendTopic = {
  id: string;
  name: string;
};

type ResendBroadcast = {
  id: string;
  name: string;
  status: 'draft' | 'queued' | 'sent';
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
};

type CreateResendEventAlertBroadcastOptions = {
  eventId: string;
  segmentId: string;
  topicId?: string | null;
  from: string;
  subject: string;
  html: string;
  text: string;
  previewText?: string;
};

export type EventAlertsStorageDriver = 'cloudflare-kv' | 'upstash' | 'resend-segment';

const DEFAULT_STORAGE_KEY = 'megabunnish:event-alerts';
const DEFAULT_RESEND_SEGMENT_NAME = 'Megabunnish Event Alerts';
const DEFAULT_RESEND_TOPIC_NAME = 'Megabunnish Event Alerts';
const RESEND_API_BASE_URL = 'https://api.resend.com';
const RESEND_EVENT_BROADCAST_PREFIX = 'megabunnish:event-alert:';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

let cachedResendSegmentId: string | null = null;
let cachedResendTopicId: string | null = null;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

export function isValidEventAlertEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function getResendSegmentName(env: EventAlertsEnv) {
  return env.EVENT_ALERTS_RESEND_SEGMENT_NAME?.trim() || DEFAULT_RESEND_SEGMENT_NAME;
}

function getResendTopicName(env: EventAlertsEnv) {
  return env.EVENT_ALERTS_RESEND_TOPIC_NAME?.trim() || DEFAULT_RESEND_TOPIC_NAME;
}

function getResendApiKey(env: EventAlertsEnv) {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY on this deployment.');
  }

  return apiKey;
}

async function resendRequest<T>(env: EventAlertsEnv, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getResendApiKey(env)}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${RESEND_API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const payload = await response.json().catch(() => null) as { message?: string; name?: string } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string'
        ? payload.name
        : `Resend API error (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

async function listAllResendPages<T extends { id: string }>(env: EventAlertsEnv, pathBuilder: (after?: string) => string) {
  const items: T[] = [];
  let after: string | undefined;

  while (true) {
    const page = await resendRequest<ResendPaginatedResponse<T>>(env, pathBuilder(after));
    const chunk = Array.isArray(page.data) ? page.data : [];
    items.push(...chunk);

    if (!page.has_more || !chunk.length) {
      return items;
    }

    after = chunk[chunk.length - 1]?.id;
    if (!after) {
      return items;
    }
  }
}

async function ensureResendSegment(env: EventAlertsEnv) {
  if (cachedResendSegmentId) {
    return cachedResendSegmentId;
  }

  const segmentName = getResendSegmentName(env);
  const segments = await listAllResendPages<ResendSegment>(env, (after) => {
    const params = new URLSearchParams({ limit: '100' });
    if (after) {
      params.set('after', after);
    }
    return `/segments?${params.toString()}`;
  });

  const existing = segments.find((segment) => segment.name === segmentName);
  if (existing) {
    cachedResendSegmentId = existing.id;
    return existing.id;
  }

  const created = await resendRequest<{ id: string }>(env, '/segments', {
    method: 'POST',
    body: JSON.stringify({ name: segmentName })
  });

  cachedResendSegmentId = created.id;
  return created.id;
}

async function ensureResendTopic(env: EventAlertsEnv) {
  if (cachedResendTopicId) {
    return cachedResendTopicId;
  }

  const topicName = getResendTopicName(env);
  const response = await resendRequest<{ data: ResendTopic[] }>(env, '/topics');
  const topics = Array.isArray(response.data) ? response.data : [];
  const existing = topics.find((topic) => topic.name === topicName);
  if (existing) {
    cachedResendTopicId = existing.id;
    return existing.id;
  }

  const created = await resendRequest<{ id: string }>(env, '/topics', {
    method: 'POST',
    body: JSON.stringify({
      name: topicName,
      description: 'Megabunnish event alerts',
      default_subscription: 'opt_in'
    })
  });

  cachedResendTopicId = created.id;
  return created.id;
}

async function listResendSegmentContacts(env: EventAlertsEnv) {
  const segmentId = await ensureResendSegment(env);
  return listAllResendPages<ResendContact>(env, (after) => {
    const params = new URLSearchParams({ limit: '100' });
    if (after) {
      params.set('after', after);
    }
    return `/segments/${segmentId}/contacts?${params.toString()}`;
  });
}

async function listResendEventBroadcasts(env: EventAlertsEnv) {
  const broadcasts = await listAllResendPages<ResendBroadcast>(env, (after) => {
    const params = new URLSearchParams({ limit: '100' });
    if (after) {
      params.set('after', after);
    }
    return `/broadcasts?${params.toString()}`;
  });

  return broadcasts.filter((broadcast) => broadcast.name.startsWith(RESEND_EVENT_BROADCAST_PREFIX));
}

async function getResendContact(env: EventAlertsEnv, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${RESEND_API_BASE_URL}/contacts/${encodeURIComponent(normalizedEmail)}`, {
    headers: {
      Authorization: `Bearer ${getResendApiKey(env)}`
    }
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => null) as { message?: string; name?: string } | ResendContact | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string'
        ? payload.name
        : `Resend API error (${response.status})`;
    throw new Error(message);
  }

  return payload as ResendContact | null;
}

function buildResendProperties(source: string, nowIso: string, status: 'subscribed' | 'unsubscribed') {
  return {
    event_alert_source: source,
    event_alert_status: status,
    event_alert_updated_at: nowIso,
    event_alert_unsubscribed_at: status === 'unsubscribed' ? nowIso : null
  };
}

async function readResendStoreData(env: EventAlertsEnv): Promise<EventAlertsStoreData> {
  const contacts = await listResendSegmentContacts(env);
  const subscribers = contacts.map((contact) => ({
    email: normalizeEmail(contact.email),
    status: 'subscribed' as const,
    source: 'resend_segment',
    subscribedAt: contact.created_at,
    unsubscribedAt: null,
    updatedAt: contact.created_at
  }));
  const activeEmails = uniqueSorted(subscribers.map((subscriber) => subscriber.email));
  const broadcasts = await listResendEventBroadcasts(env);
  const deliveries = broadcasts
    .filter((broadcast) => broadcast.status === 'queued' || broadcast.status === 'sent')
    .map((broadcast) => {
      const eventId = broadcast.name.slice(RESEND_EVENT_BROADCAST_PREFIX.length);
      const deliveredAt = broadcast.sent_at ?? broadcast.scheduled_at ?? broadcast.created_at;
      return {
        eventId,
        subject: broadcast.name,
        deliveredEmails: activeEmails,
        resendEmailIds: [broadcast.id],
        lastAttemptAt: deliveredAt,
        lastDeliveredAt: deliveredAt,
        lastFailedEmails: [],
        lastAttemptedCount: activeEmails.length,
        lastSentCount: activeEmails.length,
        lastFailedCount: 0,
        createdAt: broadcast.created_at,
        updatedAt: deliveredAt
      } satisfies EventAlertDelivery;
    });

  return sortStoreData({
    version: 1,
    subscribers,
    deliveries
  });
}

export function getStorageDriver(env: EventAlertsEnv): EventAlertsStorageDriver {
  if (env.EVENT_ALERTS) {
    return 'cloudflare-kv';
  }

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }

  if (env.RESEND_API_KEY) {
    return 'resend-segment';
  }

  throw new Error('Event alert storage is not configured on this deployment. Configure the EVENT_ALERTS KV binding, Upstash Redis environment variables, or RESEND_API_KEY.');
}

function getStorageKey(env: EventAlertsEnv) {
  return env.EVENT_ALERTS_STORAGE_KEY?.trim() || DEFAULT_STORAGE_KEY;
}

function getBaseUrl(request: Request, env: EventAlertsEnv) {
  const configured = env.EVENT_ALERTS_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return new URL(request.url).origin.replace(/\/$/, '');
}

function getKvNamespace(env: EventAlertsEnv) {
  if (!env.EVENT_ALERTS) {
    throw new Error('Event alert storage is not configured on this deployment. Configure the EVENT_ALERTS KV binding, Upstash Redis environment variables, or RESEND_API_KEY.');
  }

  return env.EVENT_ALERTS;
}

function getRedis(env: EventAlertsEnv) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Event alert storage is not configured on this deployment. Configure the EVENT_ALERTS KV binding, Upstash Redis environment variables, or RESEND_API_KEY.');
  }

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });
}

export async function readStoreData(env: EventAlertsEnv) {
  const storageDriver = getStorageDriver(env);

  if (storageDriver === 'resend-segment') {
    return readResendStoreData(env);
  }

  if (storageDriver === 'cloudflare-kv') {
    const rawValue = await getKvNamespace(env).get(getStorageKey(env), 'json');
    return rawValue ? normalizeStoreData(rawValue) : createEmptyStoreData();
  }

  const rawValue = await getRedis(env).get(getStorageKey(env));
  if (!rawValue) {
    return createEmptyStoreData();
  }

  if (typeof rawValue === 'string') {
    return normalizeStoreData(JSON.parse(rawValue) as unknown);
  }

  return normalizeStoreData(rawValue);
}

export async function writeStoreData(env: EventAlertsEnv, data: EventAlertsStoreData) {
  const storageDriver = getStorageDriver(env);
  if (storageDriver === 'resend-segment') {
    return;
  }

  const normalized = sortStoreData(normalizeStoreData(data));
  const payload = JSON.stringify(normalized);

  if (storageDriver === 'cloudflare-kv') {
    await getKvNamespace(env).put(getStorageKey(env), payload);
    return;
  }

  await getRedis(env).set(getStorageKey(env), payload);
}

function getOrCreateDeliveryRecord(data: EventAlertsStoreData, eventId: string, subject: string, nowIso: string) {
  let delivery = data.deliveries.find((entry) => entry.eventId === eventId);
  if (!delivery) {
    delivery = {
      eventId,
      subject,
      deliveredEmails: [],
      resendEmailIds: [],
      lastAttemptAt: null,
      lastDeliveredAt: null,
      lastFailedEmails: [],
      lastAttemptedCount: 0,
      lastSentCount: 0,
      lastFailedCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    data.deliveries.push(delivery);
  }

  delivery.subject = subject;
  delivery.updatedAt = nowIso;
  return delivery;
}

export async function getEventAlertsSnapshot(env: EventAlertsEnv) {
  const data = await readStoreData(env);
  const activeSubscribers = data.subscribers.filter((subscriber) => subscriber.status === 'subscribed');
  const storageDriver = getStorageDriver(env);

  return {
    storageDriver,
    storageKey: storageDriver === 'resend-segment' ? getResendSegmentName(env) : getStorageKey(env),
    subscribers: data.subscribers,
    deliveries: data.deliveries,
    activeSubscribers,
    activeSubscriberEmails: activeSubscribers.map((subscriber) => subscriber.email)
  };
}

export async function subscribeEventAlertSubscriber(env: EventAlertsEnv, email: string, source = 'events_panel') {
  if (getStorageDriver(env) === 'resend-segment') {
    const normalizedEmail = normalizeEmail(email);
    const nowIso = new Date().toISOString();
    const segmentId = await ensureResendSegment(env);
    const topicId = await ensureResendTopic(env);
    const segmentContacts = await listResendSegmentContacts(env);
    const isInSegment = segmentContacts.some((contact) => normalizeEmail(contact.email) === normalizedEmail);
    const existing = await getResendContact(env, normalizedEmail);

    if (!existing) {
      await resendRequest(env, '/contacts', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          unsubscribed: false,
          properties: {
            ...buildResendProperties(source, nowIso, 'subscribed'),
            event_alert_subscribed_at: nowIso
          },
          segments: [{ id: segmentId }],
          topics: [{ id: topicId, subscription: 'opt_in' }]
        })
      });
    } else {
      await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unsubscribed: false,
          properties: buildResendProperties(source, nowIso, 'subscribed')
        })
      });

      if (!isInSegment) {
        await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}/segments/${segmentId}`, {
          method: 'POST'
        });
      }

      await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}/topics`, {
        method: 'PATCH',
        body: JSON.stringify([{ id: topicId, subscription: 'opt_in' }])
      });
    }

    return {
      email: normalizedEmail,
      activeSubscriberCount: isInSegment ? segmentContacts.length : segmentContacts.length + 1,
      storageDriver: getStorageDriver(env)
    };
  }

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
    storageDriver: getStorageDriver(env)
  };
}

export async function unsubscribeEventAlertSubscriber(env: EventAlertsEnv, email: string) {
  if (getStorageDriver(env) === 'resend-segment') {
    const normalizedEmail = normalizeEmail(email);
    const nowIso = new Date().toISOString();
    const segmentContacts = await listResendSegmentContacts(env);
    const isInSegment = segmentContacts.some((contact) => normalizeEmail(contact.email) === normalizedEmail);
    const existing = await getResendContact(env, normalizedEmail);

    if (existing) {
      if (isInSegment) {
        await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}/segments/${await ensureResendSegment(env)}`, {
          method: 'DELETE'
        });
      }

      await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: buildResendProperties('events_panel', nowIso, 'unsubscribed')
        })
      });

      await resendRequest(env, `/contacts/${encodeURIComponent(normalizedEmail)}/topics`, {
        method: 'PATCH',
        body: JSON.stringify([{ id: await ensureResendTopic(env), subscription: 'opt_out' }])
      });
    }

    return {
      email: normalizedEmail,
      activeSubscriberCount: isInSegment ? Math.max(0, segmentContacts.length - 1) : segmentContacts.length,
      storageDriver: getStorageDriver(env)
    };
  }

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
    storageDriver: getStorageDriver(env)
  };
}

export async function recordEventAlertDelivery(env: EventAlertsEnv, update: DeliveryUpdate) {
  if (getStorageDriver(env) === 'resend-segment') {
    const nowIso = new Date().toISOString();
    return {
      eventId: update.eventId,
      subject: update.subject,
      deliveredEmails: uniqueSorted(update.deliveredEmails.map(normalizeEmail)),
      resendEmailIds: uniqueSorted(update.resendEmailIds.filter(Boolean)),
      lastAttemptAt: nowIso,
      lastDeliveredAt: update.deliveredEmails.length ? nowIso : null,
      lastFailedEmails: uniqueSorted(update.failedEmails.map(normalizeEmail)),
      lastAttemptedCount: update.attemptedCount,
      lastSentCount: update.deliveredEmails.length,
      lastFailedCount: update.failedEmails.length,
      createdAt: nowIso,
      updatedAt: nowIso
    } satisfies EventAlertDelivery;
  }

  const data = await readStoreData(env);
  const nowIso = new Date().toISOString();
  const delivery = getOrCreateDeliveryRecord(data, update.eventId, update.subject, nowIso);

  delivery.deliveredEmails = uniqueSorted([...delivery.deliveredEmails, ...update.deliveredEmails.map(normalizeEmail)]);
  delivery.resendEmailIds = uniqueSorted([...delivery.resendEmailIds, ...update.resendEmailIds.filter(Boolean)]);
  delivery.lastAttemptAt = nowIso;
  delivery.lastDeliveredAt = update.deliveredEmails.length ? nowIso : delivery.lastDeliveredAt;
  delivery.lastFailedEmails = uniqueSorted(update.failedEmails.map(normalizeEmail));
  delivery.lastAttemptedCount = update.attemptedCount;
  delivery.lastSentCount = update.deliveredEmails.length;
  delivery.lastFailedCount = update.failedEmails.length;
  delivery.updatedAt = nowIso;

  await writeStoreData(env, data);

  return delivery;
}

export function getDeliveredEmailsForEvent(deliveries: EventAlertDelivery[], eventId: string) {
  return deliveries.find((entry) => entry.eventId === eventId)?.deliveredEmails ?? [];
}

export function buildEventAlertBroadcastName(eventId: string) {
  return `${RESEND_EVENT_BROADCAST_PREFIX}${eventId}`;
}

export async function ensureResendEventAlertTarget(env: EventAlertsEnv) {
  return {
    segmentId: await ensureResendSegment(env),
    topicId: await ensureResendTopic(env)
  };
}

export async function createResendEventAlertBroadcast(env: EventAlertsEnv, options: CreateResendEventAlertBroadcastOptions) {
  return resendRequest<{ id: string }>(env, '/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      name: buildEventAlertBroadcastName(options.eventId),
      segment_id: options.segmentId,
      topic_id: options.topicId ?? null,
      from: options.from,
      subject: options.subject,
      preview_text: options.previewText,
      html: options.html,
      text: options.text,
      send: true
    })
  });
}

export function readHeader(request: Request, key: string) {
  return request.headers.get(key) ?? request.headers.get(key.toLowerCase());
}

export function isAdminAuthorized(request: Request, env: EventAlertsEnv) {
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

export function jsonResponse(payload: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

export function htmlResponse(html: string, status = 200, extraHeaders?: HeadersInit) {
  return new Response(html, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      ...extraHeaders
    }
  });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getUnsubscribeSecret(env: EventAlertsEnv) {
  const secret = env.EVENT_ALERTS_UNSUBSCRIBE_SECRET ?? env.EVENT_ALERTS_CRON_SECRET ?? env.RESEND_API_KEY;
  if (!secret) {
    throw new Error('Unsubscribe links are not configured on this deployment.');
  }

  return secret;
}

export async function buildUnsubscribeToken(env: EventAlertsEnv, email: string) {
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

export async function verifyEventAlertUnsubscribeToken(env: EventAlertsEnv, email: string, token: string) {
  const expected = await buildUnsubscribeToken(env, email);
  return timingSafeCompare(expected, token);
}

export async function parseJsonBody(request: Request) {
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

export function getAlertApiBaseUrl(request: Request, env: EventAlertsEnv) {
  return getBaseUrl(request, env);
}

export function buildEventAlertApiUrl(request: Request, env: EventAlertsEnv, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getBaseUrl(request, env)}${normalizedPath}`;
}