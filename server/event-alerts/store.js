var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var RESEND_API_BASE_URL = 'https://api.resend.com';
var DEFAULT_RESEND_SEGMENT_NAME = 'Megabunnish Event Alerts';
var DEFAULT_RESEND_TOPIC_NAME = 'Megabunnish Event Alerts';
var RESEND_EVENT_BROADCAST_PREFIX = 'megabunnish:event-alert:';
var cachedRedisClient = null;
var cachedResendSegmentId = null;
var cachedResendTopicId = null;
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
    var _a;
    return ((_a = process.env.EVENT_ALERTS_STORAGE_PATH) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_STORAGE_PATH;
}
function getStorageKey() {
    var _a;
    return ((_a = process.env.EVENT_ALERTS_STORAGE_KEY) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_STORAGE_KEY;
}
function getResendSegmentName() {
    var _a;
    return ((_a = process.env.EVENT_ALERTS_RESEND_SEGMENT_NAME) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_RESEND_SEGMENT_NAME;
}
function getResendTopicName() {
    var _a;
    return ((_a = process.env.EVENT_ALERTS_RESEND_TOPIC_NAME) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_RESEND_TOPIC_NAME;
}
function getResendApiKey() {
    var _a;
    var apiKey = (_a = process.env.RESEND_API_KEY) === null || _a === void 0 ? void 0 : _a.trim();
    if (!apiKey) {
        throw new Error('Missing RESEND_API_KEY.');
    }
    return apiKey;
}
function normalizeResendApiErrorMessage(message) {
    if (message.toLowerCase().includes('restricted to only send emails')) {
        return 'RESEND_API_KEY is send-only. Event alert subscriptions use Resend Contacts, Segments, Topics, and Broadcasts. Replace it with a full-access Resend API key, or configure Upstash/KV storage instead.';
    }
    return message;
}
function resendRequest(path_1) {
    return __awaiter(this, arguments, void 0, function (path, init) {
        var headers, response, payload, message;
        if (init === void 0) { init = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = new Headers(init.headers);
                    headers.set('Authorization', "Bearer ".concat(getResendApiKey()));
                    if (init.body && !headers.has('Content-Type')) {
                        headers.set('Content-Type', 'application/json');
                    }
                    return [4 /*yield*/, fetch("".concat(RESEND_API_BASE_URL).concat(path), __assign(__assign({}, init), { headers: headers }))];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json().catch(function () { return null; })];
                case 2:
                    payload = _a.sent();
                    if (!response.ok) {
                        message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
                            ? payload.message
                            : payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string'
                                ? payload.name
                                : "Resend API error (".concat(response.status, ")");
                        throw new Error(normalizeResendApiErrorMessage(message));
                    }
                    return [2 /*return*/, payload];
            }
        });
    });
}
function listAllResendPages(pathBuilder) {
    return __awaiter(this, void 0, void 0, function () {
        var items, after, page, chunk;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    items = [];
                    _b.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    return [4 /*yield*/, resendRequest(pathBuilder(after))];
                case 2:
                    page = _b.sent();
                    chunk = Array.isArray(page.data) ? page.data : [];
                    items.push.apply(items, chunk);
                    if (!page.has_more || !chunk.length) {
                        return [2 /*return*/, items];
                    }
                    after = (_a = chunk[chunk.length - 1]) === null || _a === void 0 ? void 0 : _a.id;
                    if (!after) {
                        return [2 /*return*/, items];
                    }
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function ensureResendSegment() {
    return __awaiter(this, void 0, void 0, function () {
        var segmentName, segments, existing, created;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (cachedResendSegmentId) {
                        return [2 /*return*/, cachedResendSegmentId];
                    }
                    segmentName = getResendSegmentName();
                    return [4 /*yield*/, listAllResendPages(function (after) {
                            var params = new URLSearchParams({ limit: '100' });
                            if (after) {
                                params.set('after', after);
                            }
                            return "/segments?".concat(params.toString());
                        })];
                case 1:
                    segments = _a.sent();
                    existing = segments.find(function (segment) { return segment.name === segmentName; });
                    if (existing) {
                        cachedResendSegmentId = existing.id;
                        return [2 /*return*/, existing.id];
                    }
                    return [4 /*yield*/, resendRequest('/segments', {
                            method: 'POST',
                            body: JSON.stringify({ name: segmentName })
                        })];
                case 2:
                    created = _a.sent();
                    cachedResendSegmentId = created.id;
                    return [2 /*return*/, created.id];
            }
        });
    });
}
function ensureResendTopic() {
    return __awaiter(this, void 0, void 0, function () {
        var topicName, response, topics, existing, created;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (cachedResendTopicId) {
                        return [2 /*return*/, cachedResendTopicId];
                    }
                    topicName = getResendTopicName();
                    return [4 /*yield*/, resendRequest('/topics')];
                case 1:
                    response = _a.sent();
                    topics = Array.isArray(response.data) ? response.data : [];
                    existing = topics.find(function (topic) { return topic.name === topicName; });
                    if (existing) {
                        cachedResendTopicId = existing.id;
                        return [2 /*return*/, existing.id];
                    }
                    return [4 /*yield*/, resendRequest('/topics', {
                            method: 'POST',
                            body: JSON.stringify({
                                name: topicName,
                                description: 'Megabunnish event alerts',
                                default_subscription: 'opt_in'
                            })
                        })];
                case 2:
                    created = _a.sent();
                    cachedResendTopicId = created.id;
                    return [2 /*return*/, created.id];
            }
        });
    });
}
function listResendSegmentContacts() {
    return __awaiter(this, void 0, void 0, function () {
        var segmentId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ensureResendSegment()];
                case 1:
                    segmentId = _a.sent();
                    return [2 /*return*/, listAllResendPages(function (after) {
                            var params = new URLSearchParams({ limit: '100' });
                            if (after) {
                                params.set('after', after);
                            }
                            return "/segments/".concat(segmentId, "/contacts?").concat(params.toString());
                        })];
            }
        });
    });
}
function listResendEventBroadcasts() {
    return __awaiter(this, void 0, void 0, function () {
        var broadcasts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, listAllResendPages(function (after) {
                        var params = new URLSearchParams({ limit: '100' });
                        if (after) {
                            params.set('after', after);
                        }
                        return "/broadcasts?".concat(params.toString());
                    })];
                case 1:
                    broadcasts = _a.sent();
                    return [2 /*return*/, broadcasts.filter(function (broadcast) { return broadcast.name.startsWith(RESEND_EVENT_BROADCAST_PREFIX); })];
            }
        });
    });
}
function getResendContact(email) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedEmail, response, payload, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalizedEmail = normalizeEmail(email);
                    return [4 /*yield*/, fetch("".concat(RESEND_API_BASE_URL, "/contacts/").concat(encodeURIComponent(normalizedEmail)), {
                            headers: {
                                Authorization: "Bearer ".concat(getResendApiKey())
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (response.status === 404) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, response.json().catch(function () { return null; })];
                case 2:
                    payload = _a.sent();
                    if (!response.ok) {
                        message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
                            ? payload.message
                            : payload && typeof payload === 'object' && 'name' in payload && typeof payload.name === 'string'
                                ? payload.name
                                : "Resend API error (".concat(response.status, ")");
                        throw new Error(normalizeResendApiErrorMessage(message));
                    }
                    return [2 /*return*/, payload];
            }
        });
    });
}
function buildResendProperties(source, nowIso, status) {
    return {
        event_alert_source: source,
        event_alert_status: status,
        event_alert_updated_at: nowIso,
        event_alert_unsubscribed_at: status === 'unsubscribed' ? nowIso : null
    };
}
function readResendStoreData() {
    return __awaiter(this, void 0, void 0, function () {
        var contacts, subscribers, activeEmails, broadcasts, deliveries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, listResendSegmentContacts()];
                case 1:
                    contacts = _a.sent();
                    subscribers = contacts.map(function (contact) { return ({
                        email: normalizeEmail(contact.email),
                        status: 'subscribed',
                        source: 'resend_segment',
                        subscribedAt: contact.created_at,
                        unsubscribedAt: null,
                        updatedAt: contact.created_at
                    }); });
                    activeEmails = uniqueSorted(subscribers.map(function (subscriber) { return subscriber.email; }));
                    return [4 /*yield*/, listResendEventBroadcasts()];
                case 2:
                    broadcasts = _a.sent();
                    deliveries = broadcasts
                        .filter(function (broadcast) { return broadcast.status === 'queued' || broadcast.status === 'sent'; })
                        .map(function (broadcast) {
                        var _a, _b;
                        var eventId = broadcast.name.slice(RESEND_EVENT_BROADCAST_PREFIX.length);
                        var deliveredAt = (_b = (_a = broadcast.sent_at) !== null && _a !== void 0 ? _a : broadcast.scheduled_at) !== null && _b !== void 0 ? _b : broadcast.created_at;
                        return {
                            eventId: eventId,
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
                        };
                    });
                    return [2 /*return*/, sortStoreData({
                            version: 1,
                            subscribers: subscribers,
                            deliveries: deliveries
                        })];
            }
        });
    });
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
                    if (getStorageDriver() === 'resend-segment') {
                        return [2 /*return*/, readResendStoreData()];
                    }
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
                    if (getStorageDriver() === 'resend-segment') {
                        return [2 /*return*/];
                    }
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
        var data, activeSubscribers, storageDriver;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readStoreData()];
                case 1:
                    data = _a.sent();
                    activeSubscribers = data.subscribers.filter(function (subscriber) { return subscriber.status === 'subscribed'; });
                    storageDriver = getStorageDriver();
                    return [2 /*return*/, {
                            storageDriver: storageDriver,
                            storagePath: storageDriver === 'file' ? getStoragePath() : null,
                            storageKey: storageDriver === 'upstash' ? getStorageKey() : storageDriver === 'resend-segment' ? getResendSegmentName() : null,
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
        var normalizedEmail_1, nowIso_1, topicId, segmentContacts, isInSegment, existing_1, _a, _b, _c, _d, _e, _f, _g, data, normalizedEmail, nowIso, existing;
        var _h, _j, _k;
        if (source === void 0) { source = 'events_panel'; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    if (!(getStorageDriver() === 'resend-segment')) return [3 /*break*/, 13];
                    normalizedEmail_1 = normalizeEmail(email);
                    nowIso_1 = new Date().toISOString();
                    return [4 /*yield*/, ensureResendTopic()];
                case 1:
                    topicId = _l.sent();
                    return [4 /*yield*/, listResendSegmentContacts()];
                case 2:
                    segmentContacts = _l.sent();
                    isInSegment = segmentContacts.some(function (contact) { return normalizeEmail(contact.email) === normalizedEmail_1; });
                    return [4 /*yield*/, getResendContact(normalizedEmail_1)];
                case 3:
                    existing_1 = _l.sent();
                    if (!!existing_1) return [3 /*break*/, 6];
                    _a = resendRequest;
                    _b = ['/contacts'];
                    _h = {
                        method: 'POST'
                    };
                    _d = (_c = JSON).stringify;
                    _j = {
                        email: normalizedEmail_1,
                        unsubscribed: false,
                        properties: __assign(__assign({}, buildResendProperties(source, nowIso_1, 'subscribed')), { event_alert_subscribed_at: nowIso_1 })
                    };
                    _k = {};
                    return [4 /*yield*/, ensureResendSegment()];
                case 4: return [4 /*yield*/, _a.apply(void 0, _b.concat([(_h.body = _d.apply(_c, [(_j.segments = [(_k.id = _l.sent(), _k)],
                                _j.topics = [{ id: topicId, subscription: 'opt_in' }],
                                _j)]),
                            _h)]))];
                case 5:
                    _l.sent();
                    return [3 /*break*/, 12];
                case 6: return [4 /*yield*/, resendRequest("/contacts/".concat(encodeURIComponent(normalizedEmail_1)), {
                        method: 'PATCH',
                        body: JSON.stringify({
                            unsubscribed: false,
                            properties: buildResendProperties(source, nowIso_1, 'subscribed')
                        })
                    })];
                case 7:
                    _l.sent();
                    if (!!isInSegment) return [3 /*break*/, 10];
                    _e = resendRequest;
                    _g = (_f = "/contacts/".concat(encodeURIComponent(normalizedEmail_1), "/segments/")).concat;
                    return [4 /*yield*/, ensureResendSegment()];
                case 8: return [4 /*yield*/, _e.apply(void 0, [_g.apply(_f, [_l.sent()]), {
                            method: 'POST'
                        }])];
                case 9:
                    _l.sent();
                    _l.label = 10;
                case 10: return [4 /*yield*/, resendRequest("/contacts/".concat(encodeURIComponent(normalizedEmail_1), "/topics"), {
                        method: 'PATCH',
                        body: JSON.stringify([{ id: topicId, subscription: 'opt_in' }])
                    })];
                case 11:
                    _l.sent();
                    _l.label = 12;
                case 12: return [2 /*return*/, {
                        email: normalizedEmail_1,
                        activeSubscriberCount: isInSegment ? segmentContacts.length : segmentContacts.length + 1,
                        storageDriver: getStorageDriver()
                    }];
                case 13: return [4 /*yield*/, readStoreData()];
                case 14:
                    data = _l.sent();
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
                case 15:
                    _l.sent();
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
        var normalizedEmail_2, nowIso_2, segmentContacts, isInSegment, existing_2, _a, _b, _c, _d, _e, _f, _g, data, normalizedEmail, nowIso, existing;
        var _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    if (!(getStorageDriver() === 'resend-segment')) return [3 /*break*/, 10];
                    normalizedEmail_2 = normalizeEmail(email);
                    nowIso_2 = new Date().toISOString();
                    return [4 /*yield*/, listResendSegmentContacts()];
                case 1:
                    segmentContacts = _k.sent();
                    isInSegment = segmentContacts.some(function (contact) { return normalizeEmail(contact.email) === normalizedEmail_2; });
                    return [4 /*yield*/, getResendContact(normalizedEmail_2)];
                case 2:
                    existing_2 = _k.sent();
                    if (!existing_2) return [3 /*break*/, 9];
                    if (!isInSegment) return [3 /*break*/, 5];
                    _a = resendRequest;
                    _c = (_b = "/contacts/".concat(encodeURIComponent(normalizedEmail_2), "/segments/")).concat;
                    return [4 /*yield*/, ensureResendSegment()];
                case 3: return [4 /*yield*/, _a.apply(void 0, [_c.apply(_b, [_k.sent()]), {
                            method: 'DELETE'
                        }])];
                case 4:
                    _k.sent();
                    _k.label = 5;
                case 5: return [4 /*yield*/, resendRequest("/contacts/".concat(encodeURIComponent(normalizedEmail_2)), {
                        method: 'PATCH',
                        body: JSON.stringify({
                            properties: buildResendProperties('events_panel', nowIso_2, 'unsubscribed')
                        })
                    })];
                case 6:
                    _k.sent();
                    _d = resendRequest;
                    _e = ["/contacts/".concat(encodeURIComponent(normalizedEmail_2), "/topics")];
                    _h = {
                        method: 'PATCH'
                    };
                    _g = (_f = JSON).stringify;
                    _j = {};
                    return [4 /*yield*/, ensureResendTopic()];
                case 7: return [4 /*yield*/, _d.apply(void 0, _e.concat([(_h.body = _g.apply(_f, [[(_j.id = _k.sent(), _j.subscription = 'opt_out', _j)]]),
                            _h)]))];
                case 8:
                    _k.sent();
                    _k.label = 9;
                case 9: return [2 /*return*/, {
                        email: normalizedEmail_2,
                        activeSubscriberCount: isInSegment ? Math.max(0, segmentContacts.length - 1) : segmentContacts.length,
                        storageDriver: getStorageDriver()
                    }];
                case 10: return [4 /*yield*/, readStoreData()];
                case 11:
                    data = _k.sent();
                    normalizedEmail = normalizeEmail(email);
                    nowIso = new Date().toISOString();
                    existing = data.subscribers.find(function (subscriber) { return subscriber.email === normalizedEmail; });
                    if (!existing) return [3 /*break*/, 13];
                    existing.status = 'unsubscribed';
                    existing.unsubscribedAt = nowIso;
                    existing.updatedAt = nowIso;
                    return [4 /*yield*/, writeStoreData(data)];
                case 12:
                    _k.sent();
                    _k.label = 13;
                case 13: return [2 /*return*/, {
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
        var nowIso_3, data, nowIso, delivery;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (getStorageDriver() === 'resend-segment') {
                        nowIso_3 = new Date().toISOString();
                        return [2 /*return*/, {
                                eventId: update.eventId,
                                subject: update.subject,
                                deliveredEmails: uniqueSorted(update.deliveredEmails.map(normalizeEmail)),
                                resendEmailIds: uniqueSorted(update.resendEmailIds.filter(Boolean)),
                                lastAttemptAt: nowIso_3,
                                lastDeliveredAt: update.deliveredEmails.length ? nowIso_3 : null,
                                lastFailedEmails: uniqueSorted(update.failedEmails.map(normalizeEmail)),
                                lastAttemptedCount: update.attemptedCount,
                                lastSentCount: update.deliveredEmails.length,
                                lastFailedCount: update.failedEmails.length,
                                createdAt: nowIso_3,
                                updatedAt: nowIso_3
                            }];
                    }
                    return [4 /*yield*/, readStoreData()];
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
export function buildEventAlertBroadcastName(eventId) {
    return "".concat(RESEND_EVENT_BROADCAST_PREFIX).concat(eventId);
}
export function ensureResendEventAlertTarget() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = {};
                    return [4 /*yield*/, ensureResendSegment()];
                case 1:
                    _a.segmentId = _b.sent();
                    return [4 /*yield*/, ensureResendTopic()];
                case 2: return [2 /*return*/, (_a.topicId = _b.sent(),
                        _a)];
            }
        });
    });
}
export function ensureEventAlertStorage() {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(getStorageDriver() === 'resend-segment')) return [3 /*break*/, 3];
                    return [4 /*yield*/, ensureResendSegment()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ensureResendTopic()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, readStoreData()];
                case 4:
                    data = _a.sent();
                    return [4 /*yield*/, writeStoreData(data)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
