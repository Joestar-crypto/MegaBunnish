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
var _a, _b;
import { AiAdvisorConfigError, generateAiAdvisorReply } from '../server/ai-advisor';
var DAILY_SOFT_LIMIT = 500;
var DAILY_HARD_LIMIT = 1000;
var MAX_HISTORY_MESSAGES = 6;
var MAX_MESSAGE_LENGTH = 400;
var MIN_MESSAGE_LENGTH = 3;
var UPSTASH_URL = (_a = process.env.UPSTASH_REDIS_REST_URL) === null || _a === void 0 ? void 0 : _a.trim();
var UPSTASH_TOKEN = (_b = process.env.UPSTASH_REDIS_REST_TOKEN) === null || _b === void 0 ? void 0 : _b.trim();
function parseBody(body) {
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        }
        catch (_a) {
            return {};
        }
    }
    if (body && typeof body === 'object') {
        return body;
    }
    return {};
}
function sanitizeHistory(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map(function (entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        var role = 'role' in entry ? entry.role : undefined;
        var content = 'content' in entry ? entry.content : undefined;
        if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
            return null;
        }
        return { role: role, content: content };
    })
        .filter(function (entry) { return Boolean(entry); })
        .slice(-MAX_HISTORY_MESSAGES);
}
function getBudgetKey(date) {
    if (date === void 0) { date = new Date(); }
    return "megabunnish:ai-budget:".concat(date.toISOString().slice(0, 10));
}
function getNextUtcMidnight(date) {
    if (date === void 0) { date = new Date(); }
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));
}
function runUpstashCommand(command) {
    return __awaiter(this, void 0, void 0, function () {
        var response, payload;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, fetch(UPSTASH_URL, {
                            method: 'POST',
                            headers: {
                                Authorization: "Bearer ".concat(UPSTASH_TOKEN),
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(command)
                        })];
                case 1:
                    response = _b.sent();
                    if (!response.ok) {
                        throw new Error("Budget store request failed (".concat(response.status, ")."));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    payload = (_b.sent());
                    return [2 /*return*/, (_a = payload.result) !== null && _a !== void 0 ? _a : null];
            }
        });
    });
}
function buildBudgetStatus(count, now) {
    if (now === void 0) { now = new Date(); }
    return {
        enabled: Boolean(UPSTASH_URL && UPSTASH_TOKEN),
        key: getBudgetKey(now),
        count: count,
        softLimit: DAILY_SOFT_LIMIT,
        hardLimit: DAILY_HARD_LIMIT,
        warning: count >= DAILY_SOFT_LIMIT,
        blocked: count >= DAILY_HARD_LIMIT,
        resetsAtUtc: getNextUtcMidnight(now).toISOString()
    };
}
function readBudgetStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var raw, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
                        return [2 /*return*/, buildBudgetStatus(0)];
                    }
                    return [4 /*yield*/, runUpstashCommand(['GET', getBudgetKey()])];
                case 1:
                    raw = _a.sent();
                    count = typeof raw === 'number' ? raw : Number(raw !== null && raw !== void 0 ? raw : 0) || 0;
                    return [2 /*return*/, buildBudgetStatus(count)];
            }
        });
    });
}
function incrementBudgetCounter() {
    return __awaiter(this, void 0, void 0, function () {
        var now, key, nextMidnight, raw, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
                        return [2 /*return*/, buildBudgetStatus(0)];
                    }
                    now = new Date();
                    key = getBudgetKey(now);
                    nextMidnight = getNextUtcMidnight(now);
                    return [4 /*yield*/, runUpstashCommand(['INCR', key])];
                case 1:
                    raw = _a.sent();
                    count = typeof raw === 'number' ? raw : Number(raw !== null && raw !== void 0 ? raw : 0) || 0;
                    // Reset the daily budget automatically at midnight UTC.
                    return [4 /*yield*/, runUpstashCommand(['EXPIREAT', key, Math.floor(nextMidnight.getTime() / 1000)])];
                case 2:
                    // Reset the daily budget automatically at midnight UTC.
                    _a.sent();
                    return [2 /*return*/, buildBudgetStatus(count, now)];
            }
        });
    });
}
export default function handler(request, response) {
    return __awaiter(this, void 0, void 0, function () {
        var budget, error_1, payload, message, conversationId, budget, result, error_2, statusCode;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    response.setHeader('Cache-Control', 'no-store');
                    response.setHeader('Content-Type', 'application/json; charset=utf-8');
                    response.setHeader('Allow', 'GET, POST');
                    if (!(request.method === 'GET')) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, readBudgetStatus()];
                case 2:
                    budget = _a.sent();
                    response.status(200).json({ ok: true, budget: budget });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    response.status(500).json({
                        error: error_1 instanceof Error ? error_1.message : 'Unable to read budget status right now.'
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
                case 5:
                    if (request.method !== 'POST') {
                        response.status(405).json({ error: 'Method not allowed.' });
                        return [2 /*return*/];
                    }
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 9, , 10]);
                    payload = parseBody(request.body);
                    // Hidden honeypot field catches basic scripted form submissions.
                    if (typeof payload.honeypot === 'string' && payload.honeypot.trim()) {
                        response.status(400).json({ error: 'That send looked automated, so I ignored it.' });
                        return [2 /*return*/];
                    }
                    message = typeof payload.message === 'string' ? payload.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
                    if (message.length < MIN_MESSAGE_LENGTH) {
                        response.status(400).json({ error: 'Give me a little more to work with.' });
                        return [2 /*return*/];
                    }
                    conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
                    return [4 /*yield*/, incrementBudgetCounter()];
                case 7:
                    budget = _a.sent();
                    if (budget.blocked) {
                        response.status(429).json({
                            error: 'Daily limit reached, back tomorrow.',
                            budget: budget
                        });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, generateAiAdvisorReply({
                            message: message,
                            history: sanitizeHistory(payload.history),
                            conversationId: conversationId
                        })];
                case 8:
                    result = _a.sent();
                    response.status(200).json(__assign(__assign({ ok: true }, result), { budget: budget }));
                    return [3 /*break*/, 10];
                case 9:
                    error_2 = _a.sent();
                    statusCode = error_2 instanceof AiAdvisorConfigError ? 503 : 500;
                    response.status(statusCode).json({
                        error: error_2 instanceof Error ? error_2.message : 'Unable to answer right now.'
                    });
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
