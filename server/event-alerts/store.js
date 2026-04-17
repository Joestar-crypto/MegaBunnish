var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';
var DEFAULT_STORAGE_PATH = fileURLToPath(new URL('../../.data/event-alerts.json', import.meta.url));
var DEFAULT_STORAGE_KEY = 'megabunnish:event-alerts';
var cachedRedisClient = null;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (left, right) { return left.localeCompare(right); });
}
function createEmptyStoreData() {
    return {
        version: 1,
        subscribers: [],
        deliveries: []
    };
}
function sortStoreData(data) {
    data.subscribers.sort(function (left, right) { return left.email.localeCompare(right.email); });
    data.deliveries.sort(function (left, right) { return left.eventId.localeCompare(right.eventId); });
    return data;
}
function normalizeSubscriberRecord(record) {
    if (!(record === null || record === void 0 ? void 0 : record.email)) {
        return null;
    }
    var email = normalizeEmail(record.email);
    var subscribedAt = typeof record.subscribedAt === 'string' && record.subscribedAt ? record.subscribedAt : new Date().toISOString();
    var updatedAt = typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : subscribedAt;
    var unsubscribedAt = typeof record.unsubscribedAt === 'string' && record.unsubscribedAt ? record.unsubscribedAt : null;
    return {
        email: email,
        status: record.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed',
        source: typeof record.source === 'string' && record.source ? record.source : 'events_panel',
        subscribedAt: subscribedAt,
        unsubscribedAt: unsubscribedAt,
        updatedAt: updatedAt
    };
}
function normalizeDeliveryRecord(record) {
    var _a, _b, _c;
    if (!(record === null || record === void 0 ? void 0 : record.eventId)) {
        return null;
    }
    var createdAt = typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : new Date().toISOString();
    var updatedAt = typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : createdAt;
    return {
        eventId: record.eventId,
        subject: typeof record.subject === 'string' ? record.subject : '',
        deliveredEmails: uniqueSorted(((_a = record.deliveredEmails) !== null && _a !== void 0 ? _a : []).map(normalizeEmail)),
        resendEmailIds: uniqueSorted(((_b = record.resendEmailIds) !== null && _b !== void 0 ? _b : []).filter(Boolean)),
        lastAttemptAt: typeof record.lastAttemptAt === 'string' && record.lastAttemptAt ? record.lastAttemptAt : null,
        lastDeliveredAt: typeof record.lastDeliveredAt === 'string' && record.lastDeliveredAt ? record.lastDeliveredAt : null,
        lastFailedEmails: uniqueSorted(((_c = record.lastFailedEmails) !== null && _c !== void 0 ? _c : []).map(normalizeEmail)),
        lastAttemptedCount: typeof record.lastAttemptedCount === 'number' ? record.lastAttemptedCount : 0,
        lastSentCount: typeof record.lastSentCount === 'number' ? record.lastSentCount : 0,
        lastFailedCount: typeof record.lastFailedCount === 'number' ? record.lastFailedCount : 0,
        createdAt: createdAt,
        updatedAt: updatedAt
    };
}
function normalizeStoreData(raw) {
    var candidate = raw && typeof raw === 'object' ? raw : null;
    var rawSubscribers = Array.isArray(candidate === null || candidate === void 0 ? void 0 : candidate.subscribers) ? candidate.subscribers : [];
    var rawDeliveries = Array.isArray(candidate === null || candidate === void 0 ? void 0 : candidate.deliveries) ? candidate.deliveries : [];
    return sortStoreData({
        version: 1,
        subscribers: rawSubscribers
            .map(function (record) { return normalizeSubscriberRecord(record); })
            .filter(function (record) { return Boolean(record); }),
        deliveries: rawDeliveries
            .map(function (record) { return normalizeDeliveryRecord(record); })
            .filter(function (record) { return Boolean(record); })
    });
}
function getStorageDriver() {
    var _a;
    var configuredDriver = (_a = process.env.EVENT_ALERTS_STORAGE_DRIVER) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
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
    var _a;
    return ((_a = process.env.EVENT_ALERTS_STORAGE_PATH) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_STORAGE_PATH;
}
function getStorageKey() {
    var _a;
    return ((_a = process.env.EVENT_ALERTS_STORAGE_KEY) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_STORAGE_KEY;
}
function getRedisClient() {
    if (cachedRedisClient) {
        return cachedRedisClient;
    }
    cachedRedisClient = Redis.fromEnv();
    return cachedRedisClient;
}
function readStoreData() {
    return __awaiter(this, void 0, void 0, function () {
        var redis, rawValue, rawValue, error_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(getStorageDriver() === 'upstash')) return [3 /*break*/, 2];
                    redis = getRedisClient();
                    return [4 /*yield*/, redis.get(getStorageKey())];
                case 1:
                    rawValue = _a.sent();
                    if (!rawValue) {
                        return [2 /*return*/, createEmptyStoreData()];
                    }
                    if (typeof rawValue === 'string') {
                        return [2 /*return*/, normalizeStoreData(JSON.parse(rawValue))];
                    }
                    return [2 /*return*/, normalizeStoreData(rawValue)];
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, readFile(getStoragePath(), 'utf8')];
                case 3:
                    rawValue = _a.sent();
                    return [2 /*return*/, normalizeStoreData(JSON.parse(rawValue))];
                case 4:
                    error_1 = _a.sent();
                    message = error_1 instanceof Error ? error_1.message.toLowerCase() : '';
                    if (message.includes('enoent')) {
                        return [2 /*return*/, createEmptyStoreData()];
                    }
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function writeStoreData(data) {
    return __awaiter(this, void 0, void 0, function () {
        var normalized, redis, storagePath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalized = sortStoreData(normalizeStoreData(data));
                    if (!(getStorageDriver() === 'upstash')) return [3 /*break*/, 2];
                    redis = getRedisClient();
                    return [4 /*yield*/, redis.set(getStorageKey(), JSON.stringify(normalized))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    storagePath = getStoragePath();
                    return [4 /*yield*/, mkdir(dirname(storagePath), { recursive: true })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, writeFile(storagePath, "".concat(JSON.stringify(normalized, null, 2), "\n"), 'utf8')];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getOrCreateDeliveryRecord(data, eventId, subject, nowIso) {
    var delivery = data.deliveries.find(function (entry) { return entry.eventId === eventId; });
    if (!delivery) {
        delivery = {
            eventId: eventId,
            subject: subject,
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
export function getEventAlertsSnapshot() {
    return __awaiter(this, void 0, void 0, function () {
        var data, activeSubscribers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    activeSubscribers = data.subscribers.filter(function (subscriber) { return subscriber.status === 'subscribed'; });
                    return [2 /*return*/, {
                            storageDriver: getStorageDriver(),
                            storagePath: getStorageDriver() === 'file' ? getStoragePath() : null,
                            storageKey: getStorageDriver() === 'upstash' ? getStorageKey() : null,
                            subscribers: data.subscribers,
                            deliveries: data.deliveries,
                            activeSubscribers: activeSubscribers,
                            activeSubscriberEmails: activeSubscribers.map(function (subscriber) { return subscriber.email; })
                        }];
            }
        });
    });
}
export function subscribeEventAlertSubscriber(email_1) {
    return __awaiter(this, arguments, void 0, function (email, source) {
        var data, normalizedEmail, nowIso, existing;
        if (source === void 0) { source = 'events_panel'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    normalizedEmail = normalizeEmail(email);
                    nowIso = new Date().toISOString();
                    existing = data.subscribers.find(function (subscriber) { return subscriber.email === normalizedEmail; });
                    if (existing) {
                        existing.status = 'subscribed';
                        existing.source = source;
                        existing.unsubscribedAt = null;
                        existing.updatedAt = nowIso;
                    }
                    else {
                        data.subscribers.push({
                            email: normalizedEmail,
                            status: 'subscribed',
                            source: source,
                            subscribedAt: nowIso,
                            unsubscribedAt: null,
                            updatedAt: nowIso
                        });
                    }
                    return [4 /*yield*/, writeStoreData(data)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, {
                            email: normalizedEmail,
                            activeSubscriberCount: data.subscribers.filter(function (subscriber) { return subscriber.status === 'subscribed'; }).length,
                            storageDriver: getStorageDriver()
                        }];
            }
        });
    });
}
export function unsubscribeEventAlertSubscriber(email) {
    return __awaiter(this, void 0, void 0, function () {
        var data, normalizedEmail, nowIso, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    normalizedEmail = normalizeEmail(email);
                    nowIso = new Date().toISOString();
                    existing = data.subscribers.find(function (subscriber) { return subscriber.email === normalizedEmail; });
                    if (!existing) return [3 /*break*/, 3];
                    existing.status = 'unsubscribed';
                    existing.unsubscribedAt = nowIso;
                    existing.updatedAt = nowIso;
                    return [4 /*yield*/, writeStoreData(data)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, {
                        email: normalizedEmail,
                        activeSubscriberCount: data.subscribers.filter(function (subscriber) { return subscriber.status === 'subscribed'; }).length,
                        storageDriver: getStorageDriver()
                    }];
            }
        });
    });
}
export function recordEventAlertDelivery(update) {
    return __awaiter(this, void 0, void 0, function () {
        var data, nowIso, delivery;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    nowIso = new Date().toISOString();
                    delivery = getOrCreateDeliveryRecord(data, update.eventId, update.subject, nowIso);
                    delivery.deliveredEmails = uniqueSorted(__spreadArray(__spreadArray([], delivery.deliveredEmails, true), update.deliveredEmails.map(normalizeEmail), true));
                    delivery.resendEmailIds = uniqueSorted(__spreadArray(__spreadArray([], delivery.resendEmailIds, true), update.resendEmailIds.filter(Boolean), true));
                    delivery.lastAttemptAt = nowIso;
                    delivery.lastDeliveredAt = update.deliveredEmails.length ? nowIso : delivery.lastDeliveredAt;
                    delivery.lastFailedEmails = uniqueSorted(update.failedEmails.map(normalizeEmail));
                    delivery.lastAttemptedCount = update.attemptedCount;
                    delivery.lastSentCount = update.deliveredEmails.length;
                    delivery.lastFailedCount = update.failedEmails.length;
                    delivery.updatedAt = nowIso;
                    return [4 /*yield*/, writeStoreData(data)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, delivery];
            }
        });
    });
}
export function getDeliveredEmailsForEvent(deliveries, eventId) {
    var _a, _b;
    return (_b = (_a = deliveries.find(function (entry) { return entry.eventId === eventId; })) === null || _a === void 0 ? void 0 : _a.deliveredEmails) !== null && _b !== void 0 ? _b : [];
}
export function ensureEventAlertStorage() {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    return [4 /*yield*/, writeStoreData(data)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
