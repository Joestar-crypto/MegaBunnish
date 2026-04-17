import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

export type EventAlertsStorageDriver = 'file' | 'upstash';

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

let cachedRedisClient: Redis | null = null;

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
  if (configuredDriver === 'file') {
    return 'file';
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  return 'file';
}

function getStoragePath() {
  return process.env.EVENT_ALERTS_STORAGE_PATH?.trim() || DEFAULT_STORAGE_PATH;
}

function getStorageKey() {
  return process.env.EVENT_ALERTS_STORAGE_KEY?.trim() || DEFAULT_STORAGE_KEY;
}

function getRedisClient() {
  if (cachedRedisClient) {
    return cachedRedisClient;
  }

  cachedRedisClient = Redis.fromEnv();
  return cachedRedisClient;
}

async function readStoreData(): Promise<EventAlertsStoreData> {
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

  return {
    storageDriver: getStorageDriver(),
    storagePath: getStorageDriver() === 'file' ? getStoragePath() : null,
    storageKey: getStorageDriver() === 'upstash' ? getStorageKey() : null,
    subscribers: data.subscribers,
    deliveries: data.deliveries,
    activeSubscribers,
    activeSubscriberEmails: activeSubscribers.map((subscriber) => subscriber.email)
  };
}

export async function subscribeEventAlertSubscriber(email: string, source = 'events_panel') {
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

export async function ensureEventAlertStorage() {
  const data = await readStoreData();
  await writeStoreData(data);
}