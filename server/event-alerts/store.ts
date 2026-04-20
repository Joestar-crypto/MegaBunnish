import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

export type EventAlertsStorageDriver = 'file' | 'upstash' | 'resend-segment';

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

type EventAlertsStoreData = {
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

const DEFAULT_STORAGE_PATH = fileURLToPath(new URL('../../.data/event-alerts.json', import.meta.url));
const DEFAULT_STORAGE_KEY = 'megabunnish:event-alerts';
const RESEND_API_BASE_URL = 'https://api.resend.com';
const DEFAULT_RESEND_SEGMENT_NAME = 'Megabunnish Event Alerts';
const DEFAULT_RESEND_TOPIC_NAME = 'Megabunnish Event Alerts';
const RESEND_EVENT_BROADCAST_PREFIX = 'megabunnish:event-alert:';

let cachedRedisClient: Redis | null = null;
let cachedResendSegmentId: string | null = null;
let cachedResendTopicId: string | null = null;

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

function getStorageDriver(): EventAlertsStorageDriver {
  const configuredDriver = process.env.EVENT_ALERTS_STORAGE_DRIVER?.trim().toLowerCase();
  if (configuredDriver === 'upstash' || configuredDriver === 'redis') {
    return 'upstash';
  }
  if (configuredDriver === 'resend' || configuredDriver === 'resend-segment') {
    return 'resend-segment';
  }
  if (configuredDriver === 'file') {
    return 'file';
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  if (process.env.RESEND_API_KEY) {
    return 'resend-segment';
  }
  return 'file';
}

function getStoragePath() {
  return process.env.EVENT_ALERTS_STORAGE_PATH?.trim() || DEFAULT_STORAGE_PATH;
}

function getStorageKey() {
  return process.env.EVENT_ALERTS_STORAGE_KEY?.trim() || DEFAULT_STORAGE_KEY;
}

function getResendSegmentName() {
  return process.env.EVENT_ALERTS_RESEND_SEGMENT_NAME?.trim() || DEFAULT_RESEND_SEGMENT_NAME;
}

function getResendTopicName() {
  return process.env.EVENT_ALERTS_RESEND_TOPIC_NAME?.trim() || DEFAULT_RESEND_TOPIC_NAME;
}

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY.');
  }

  return apiKey;
}

function normalizeResendApiErrorMessage(message: string) {
  if (message.toLowerCase().includes('restricted to only send emails')) {
    return 'RESEND_API_KEY is send-only. Event alert subscriptions use Resend Contacts, Segments, Topics, and Broadcasts. Replace it with a full-access Resend API key, or configure Upstash/KV storage instead.';
  }

  return message;
}

async function resendRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getResendApiKey()}`);
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
    throw new Error(normalizeResendApiErrorMessage(message));
  }

  return payload as T;
}

async function listAllResendPages<T extends { id: string }>(pathBuilder: (after?: string) => string) {
  const items: T[] = [];
  let after: string | undefined;

  while (true) {
    const page = await resendRequest<ResendPaginatedResponse<T>>(pathBuilder(after));
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

async function ensureResendSegment() {
  if (cachedResendSegmentId) {
    return cachedResendSegmentId;
  }

  const segmentName = getResendSegmentName();
  const segments = await listAllResendPages<ResendSegment>((after) => {
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

  const created = await resendRequest<{ id: string }>('/segments', {
    method: 'POST',
    body: JSON.stringify({ name: segmentName })
  });

  cachedResendSegmentId = created.id;
  return created.id;
}

async function ensureResendTopic() {
  if (cachedResendTopicId) {
    return cachedResendTopicId;
  }

  const topicName = getResendTopicName();
  const response = await resendRequest<{ data: ResendTopic[] }>('/topics');
  const topics = Array.isArray(response.data) ? response.data : [];
  const existing = topics.find((topic) => topic.name === topicName);
  if (existing) {
    cachedResendTopicId = existing.id;
    return existing.id;
  }

  const created = await resendRequest<{ id: string }>('/topics', {
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

async function listResendSegmentContacts() {
  const segmentId = await ensureResendSegment();
  return listAllResendPages<ResendContact>((after) => {
    const params = new URLSearchParams({ limit: '100' });
    if (after) {
      params.set('after', after);
    }
    return `/segments/${segmentId}/contacts?${params.toString()}`;
  });
}

async function listResendEventBroadcasts() {
  const broadcasts = await listAllResendPages<ResendBroadcast>((after) => {
    const params = new URLSearchParams({ limit: '100' });
    if (after) {
      params.set('after', after);
    }
    return `/broadcasts?${params.toString()}`;
  });

  return broadcasts.filter((broadcast) => broadcast.name.startsWith(RESEND_EVENT_BROADCAST_PREFIX));
}

async function getResendContact(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${RESEND_API_BASE_URL}/contacts/${encodeURIComponent(normalizedEmail)}`, {
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`
    }
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => null) as { message?: string; name?: string } | (ResendContact & { properties?: Record<string, { value: string | number }>; object?: string }) | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string'
        ? payload.name
        : `Resend API error (${response.status})`;
    throw new Error(normalizeResendApiErrorMessage(message));
  }

  return payload as ResendContact | null;
}

async function readResendStoreData(): Promise<EventAlertsStoreData> {
  const contacts = await listResendSegmentContacts();
  const subscribers = contacts.map((contact) => ({
    email: normalizeEmail(contact.email),
    status: 'subscribed' as const,
    source: 'resend_segment',
    subscribedAt: contact.created_at,
    unsubscribedAt: null,
    updatedAt: contact.created_at
  }));
  const activeEmails = uniqueSorted(subscribers.map((subscriber) => subscriber.email));
  const broadcasts = await listResendEventBroadcasts();
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

function getRedisClient() {
  if (cachedRedisClient) {
    return cachedRedisClient;
  }

  cachedRedisClient = Redis.fromEnv();
  return cachedRedisClient;
}

async function readStoreData(): Promise<EventAlertsStoreData> {
  if (getStorageDriver() === 'resend-segment') {
    return readResendStoreData();
  }

  if (getStorageDriver() === 'upstash') {
    const redis = getRedisClient();
    const rawValue = await redis.get(getStorageKey());
    if (!rawValue) {
      return createEmptyStoreData();
    }

    if (typeof rawValue === 'string') {
      return normalizeStoreData(JSON.parse(rawValue) as unknown);
    }

    return normalizeStoreData(rawValue);
  }

  try {
    const rawValue = await readFile(getStoragePath(), 'utf8');
    return normalizeStoreData(JSON.parse(rawValue) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('enoent')) {
      return createEmptyStoreData();
    }
    throw error;
  }
}

async function writeStoreData(data: EventAlertsStoreData) {
  const normalized = sortStoreData(normalizeStoreData(data));

  if (getStorageDriver() === 'resend-segment') {
    return;
  }

  if (getStorageDriver() === 'upstash') {
    const redis = getRedisClient();
    await redis.set(getStorageKey(), JSON.stringify(normalized));
    return;
  }

  const storagePath = getStoragePath();
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
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

export async function getEventAlertsSnapshot() {
  const data = await readStoreData();
  const activeSubscribers = data.subscribers.filter((subscriber) => subscriber.status === 'subscribed');
  const storageDriver = getStorageDriver();

  return {
    storageDriver,
    storagePath: storageDriver === 'file' ? getStoragePath() : null,
    storageKey: storageDriver === 'upstash' ? getStorageKey() : storageDriver === 'resend-segment' ? getResendSegmentName() : null,
    subscribers: data.subscribers,
    deliveries: data.deliveries,
    activeSubscribers,
    activeSubscriberEmails: activeSubscribers.map((subscriber) => subscriber.email)
  };
}

export async function subscribeEventAlertSubscriber(email: string, source = 'events_panel') {
  if (getStorageDriver() === 'resend-segment') {
    const normalizedEmail = normalizeEmail(email);
    const topicId = await ensureResendTopic();
    const segmentContacts = await listResendSegmentContacts();
    const isInSegment = segmentContacts.some((contact) => normalizeEmail(contact.email) === normalizedEmail);
    const existing = await getResendContact(normalizedEmail);

    if (!existing) {
      await resendRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          unsubscribed: false,
          segments: [{ id: await ensureResendSegment() }],
          topics: [{ id: topicId, subscription: 'opt_in' }]
        })
      });
    } else {
      await resendRequest(`/contacts/${encodeURIComponent(normalizedEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unsubscribed: false
        })
      });

      if (!isInSegment) {
        await resendRequest(`/contacts/${encodeURIComponent(normalizedEmail)}/segments/${await ensureResendSegment()}`, {
          method: 'POST'
        });
      }

      await resendRequest(`/contacts/${encodeURIComponent(normalizedEmail)}/topics`, {
        method: 'PATCH',
        body: JSON.stringify([{ id: topicId, subscription: 'opt_in' }])
      });
    }

    return {
      email: normalizedEmail,
      activeSubscriberCount: isInSegment ? segmentContacts.length : segmentContacts.length + 1,
      storageDriver: getStorageDriver()
    };
  }

  const data = await readStoreData();
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

  await writeStoreData(data);

  return {
    email: normalizedEmail,
    activeSubscriberCount: data.subscribers.filter((subscriber) => subscriber.status === 'subscribed').length,
    storageDriver: getStorageDriver()
  };
}

export async function unsubscribeEventAlertSubscriber(email: string) {
  if (getStorageDriver() === 'resend-segment') {
    const normalizedEmail = normalizeEmail(email);
    const segmentContacts = await listResendSegmentContacts();
    const isInSegment = segmentContacts.some((contact) => normalizeEmail(contact.email) === normalizedEmail);
    const existing = await getResendContact(normalizedEmail);

    if (existing) {
      if (isInSegment) {
        await resendRequest(`/contacts/${encodeURIComponent(normalizedEmail)}/segments/${await ensureResendSegment()}`, {
          method: 'DELETE'
        });
      }

      await resendRequest(`/contacts/${encodeURIComponent(normalizedEmail)}/topics`, {
        method: 'PATCH',
        body: JSON.stringify([{ id: await ensureResendTopic(), subscription: 'opt_out' }])
      });
    }

    return {
      email: normalizedEmail,
      activeSubscriberCount: isInSegment ? Math.max(0, segmentContacts.length - 1) : segmentContacts.length,
      storageDriver: getStorageDriver()
    };
  }

  const data = await readStoreData();
  const normalizedEmail = normalizeEmail(email);
  const nowIso = new Date().toISOString();
  const existing = data.subscribers.find((subscriber) => subscriber.email === normalizedEmail);

  if (existing) {
    existing.status = 'unsubscribed';
    existing.unsubscribedAt = nowIso;
    existing.updatedAt = nowIso;
    await writeStoreData(data);
  }

  return {
    email: normalizedEmail,
    activeSubscriberCount: data.subscribers.filter((subscriber) => subscriber.status === 'subscribed').length,
    storageDriver: getStorageDriver()
  };
}

export async function recordEventAlertDelivery(update: DeliveryUpdate) {
  if (getStorageDriver() === 'resend-segment') {
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

  const data = await readStoreData();
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

  await writeStoreData(data);

  return delivery;
}

export function getDeliveredEmailsForEvent(deliveries: EventAlertDelivery[], eventId: string) {
  return deliveries.find((entry) => entry.eventId === eventId)?.deliveredEmails ?? [];
}

export function buildEventAlertBroadcastName(eventId: string) {
  return `${RESEND_EVENT_BROADCAST_PREFIX}${eventId}`;
}

export async function ensureResendEventAlertTarget() {
  return {
    segmentId: await ensureResendSegment(),
    topicId: await ensureResendTopic()
  };
}

export async function ensureEventAlertStorage() {
  if (getStorageDriver() === 'resend-segment') {
    await ensureResendSegment();
    await ensureResendTopic();
    return;
  }

  const data = await readStoreData();
  await writeStoreData(data);
}