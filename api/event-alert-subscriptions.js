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
import { EventAlertsConfigError, getEventAlertUnsubscribePage, getEventAlertsStatus, isValidEventAlertEmail, subscribeToEventAlerts, unsubscribeFromEventAlerts, verifyEventAlertUnsubscribeToken } from '../server/event-alerts/service';
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
function readEmail(body) {
    var payload = parseBody(body);
    return typeof payload.email === 'string' ? payload.email : '';
}
function readQueryValue(query, key) {
    var _a;
    var value = query === null || query === void 0 ? void 0 : query[key];
    return Array.isArray(value) ? (_a = value[0]) !== null && _a !== void 0 ? _a : '' : value !== null && value !== void 0 ? value : '';
}
function readHeader(headers, key) {
    var _a;
    var value = (_a = headers === null || headers === void 0 ? void 0 : headers[key]) !== null && _a !== void 0 ? _a : headers === null || headers === void 0 ? void 0 : headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}
function isAdminAuthorized(request) {
    var _a;
    var secret = (_a = process.env.EVENT_ALERTS_ADMIN_SECRET) !== null && _a !== void 0 ? _a : process.env.EVENT_ALERTS_CRON_SECRET;
    if (!secret) {
        return false;
    }
    var authorization = readHeader(request.headers, 'authorization');
    var bearerToken = (authorization === null || authorization === void 0 ? void 0 : authorization.startsWith('Bearer ')) ? authorization.slice(7) : null;
    var querySecret = readQueryValue(request.query, 'secret');
    return bearerToken === secret || querySecret === secret;
}
function sendJson(response, statusCode, payload) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.status(statusCode).json(payload);
}
function sendHtml(response, statusCode, html) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.status(statusCode);
    if (typeof response.send === 'function') {
        response.send(html);
        return;
    }
    if (typeof response.end === 'function') {
        response.end(html);
        return;
    }
    response.json({ html: html });
}
export default function handler(request, response) {
    return __awaiter(this, void 0, void 0, function () {
        var email_1, token, action, status, email, result, result, error_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    response.setHeader('Cache-Control', 'no-store');
                    response.setHeader('Allow', 'GET,POST,DELETE');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 11, , 12]);
                    if (!(request.method === 'GET')) return [3 /*break*/, 6];
                    email_1 = readQueryValue(request.query, 'email');
                    token = readQueryValue(request.query, 'token');
                    action = readQueryValue(request.query, 'action');
                    if (!(email_1 && token)) return [3 /*break*/, 4];
                    if (!isValidEventAlertEmail(email_1)) {
                        sendJson(response, 400, { error: 'Please enter a valid email address.' });
                        return [2 /*return*/];
                    }
                    if (!verifyEventAlertUnsubscribeToken(email_1, token)) {
                        sendJson(response, 401, { error: 'Invalid unsubscribe link.' });
                        return [2 /*return*/];
                    }
                    if (!(action === 'unsubscribe')) return [3 /*break*/, 3];
                    return [4 /*yield*/, unsubscribeFromEventAlerts(email_1)];
                case 2:
                    _a.sent();
                    sendHtml(response, 200, getEventAlertUnsubscribePage(email_1, true));
                    return [2 /*return*/];
                case 3:
                    sendHtml(response, 200, getEventAlertUnsubscribePage(email_1, false));
                    return [2 /*return*/];
                case 4:
                    if (!isAdminAuthorized(request)) {
                        sendJson(response, 401, { error: 'Unauthorized.' });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getEventAlertsStatus()];
                case 5:
                    status = _a.sent();
                    sendJson(response, 200, __assign({ ok: true }, status));
                    return [2 /*return*/];
                case 6:
                    email = readEmail(request.body) || readQueryValue(request.query, 'email');
                    if (!isValidEventAlertEmail(email)) {
                        sendJson(response, 400, { error: 'Please enter a valid email address.' });
                        return [2 /*return*/];
                    }
                    if (!(request.method === 'POST')) return [3 /*break*/, 8];
                    return [4 /*yield*/, subscribeToEventAlerts(email)];
                case 7:
                    result = _a.sent();
                    sendJson(response, 200, {
                        ok: true,
                        email: result.email,
                        activeSubscriberCount: result.activeSubscriberCount,
                        storageDriver: result.storageDriver
                    });
                    return [2 /*return*/];
                case 8:
                    if (!(request.method === 'DELETE')) return [3 /*break*/, 10];
                    return [4 /*yield*/, unsubscribeFromEventAlerts(email)];
                case 9:
                    result = _a.sent();
                    sendJson(response, 200, {
                        ok: true,
                        email: result.email,
                        activeSubscriberCount: result.activeSubscriberCount,
                        storageDriver: result.storageDriver
                    });
                    return [2 /*return*/];
                case 10:
                    sendJson(response, 405, { error: 'Method not allowed.' });
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _a.sent();
                    message = error_1 instanceof EventAlertsConfigError || error_1 instanceof Error
                        ? error_1.message
                        : 'Unable to update event alerts right now.';
                    sendJson(response, 500, { error: message });
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
