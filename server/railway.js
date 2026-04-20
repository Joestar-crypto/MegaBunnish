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
import { createServer } from 'node:http';
import subscriptionsHandler from '../api/event-alert-subscriptions';
import sendEventAlertsHandler from '../api/send-event-alerts';
var PORT = readPort(process.env.PORT);
var HOST = '0.0.0.0';
var ALLOW_METHODS = 'GET,POST,DELETE,OPTIONS';
var ALLOW_HEADERS = 'Content-Type, Authorization';
function readPort(value) {
    var parsed = Number.parseInt(value !== null && value !== void 0 ? value : '3000', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}
function normalizePathname(pathname) {
    var normalized = pathname.replace(/\/+$/, '');
    return normalized || '/';
}
function buildQuery(url) {
    var query = {};
    url.searchParams.forEach(function (value, key) {
        var current = query[key];
        if (current === undefined) {
            query[key] = value;
            return;
        }
        if (Array.isArray(current)) {
            current.push(value);
            return;
        }
        query[key] = [current, value];
    });
    return query;
}
function getConfiguredOrigins() {
    var _a;
    return ((_a = process.env.EVENT_ALERTS_ALLOWED_ORIGIN) !== null && _a !== void 0 ? _a : '')
        .split(',')
        .map(function (value) { return value.trim().replace(/\/$/, ''); })
        .filter(Boolean);
}
function resolveAllowedOrigin(request) {
    var _a;
    var configuredOrigins = getConfiguredOrigins();
    if (!configuredOrigins.length) {
        return '*';
    }
    var requestOrigin = typeof request.headers.origin === 'string'
        ? request.headers.origin.trim().replace(/\/$/, '')
        : '';
    if (!requestOrigin) {
        return (_a = configuredOrigins[0]) !== null && _a !== void 0 ? _a : null;
    }
    return configuredOrigins.includes(requestOrigin) ? requestOrigin : null;
}
function applyCorsHeaders(request, response) {
    var allowedOrigin = resolveAllowedOrigin(request);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    response.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    response.setHeader('Access-Control-Max-Age', '86400');
    if (allowedOrigin) {
        response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
}
function readRequestBody(request) {
    return new Promise(function (resolve, reject) {
        var body = '';
        request.setEncoding('utf8');
        request.on('data', function (chunk) {
            body += chunk;
        });
        request.on('end', function () {
            resolve(body);
        });
        request.on('error', reject);
    });
}
function createResponseAdapter(response) {
    var statusCode = 200;
    var writePayload = function (payload) {
        response.statusCode = statusCode;
        if (payload === undefined) {
            response.end();
            return;
        }
        if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
            response.end(payload);
            return;
        }
        response.end(String(payload));
    };
    var adapter = {
        setHeader: function (name, value) {
            response.setHeader(name, value);
        },
        status: function (code) {
            statusCode = code;
            return adapter;
        },
        json: function (payload) {
            if (!response.getHeader('Content-Type')) {
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            response.statusCode = statusCode;
            response.end(JSON.stringify(payload));
        },
        send: function (payload) {
            if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
                if (!response.getHeader('Content-Type')) {
                    response.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                response.statusCode = statusCode;
                response.end(JSON.stringify(payload));
                return;
            }
            writePayload(payload);
        },
        end: function (payload) {
            writePayload(payload);
        }
    };
    return adapter;
}
function sendJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload));
}
function routeRequest(request, response) {
    return __awaiter(this, void 0, void 0, function () {
        var url, pathname, handler, body, _a, apiRequest;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    url = new URL((_b = request.url) !== null && _b !== void 0 ? _b : '/', "http://".concat((_c = request.headers.host) !== null && _c !== void 0 ? _c : 'localhost'));
                    pathname = normalizePathname(url.pathname);
                    if (pathname === '/health' || pathname === '/healthz') {
                        sendJson(response, 200, { ok: true, service: 'event-alerts-api' });
                        return [2 /*return*/];
                    }
                    if (request.method === 'OPTIONS') {
                        response.statusCode = 204;
                        response.end();
                        return [2 /*return*/];
                    }
                    handler = pathname === '/api/event-alert-subscriptions'
                        ? subscriptionsHandler
                        : pathname === '/api/send-event-alerts'
                            ? sendEventAlertsHandler
                            : null;
                    if (!handler) {
                        sendJson(response, 404, { error: 'Not found.' });
                        return [2 /*return*/];
                    }
                    if (!(request.method === 'POST' || request.method === 'DELETE')) return [3 /*break*/, 2];
                    return [4 /*yield*/, readRequestBody(request)];
                case 1:
                    _a = _d.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = undefined;
                    _d.label = 3;
                case 3:
                    body = _a;
                    apiRequest = {
                        method: request.method,
                        body: body,
                        query: buildQuery(url),
                        headers: request.headers
                    };
                    return [4 /*yield*/, handler(apiRequest, createResponseAdapter(response))];
                case 4:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var server = createServer(function (request, response) { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                applyCorsHeaders(request, response);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, routeRequest(request, response)];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                if (response.headersSent) {
                    response.end();
                    return [2 /*return*/];
                }
                sendJson(response, 500, {
                    error: error_1 instanceof Error ? error_1.message : 'Internal server error.'
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
server.listen(PORT, HOST, function () {
    console.log("Event alerts API listening on http://".concat(HOST, ":").concat(PORT));
});
