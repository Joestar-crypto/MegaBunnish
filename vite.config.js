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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import eventAlertSubscriptionsHandler from './api/event-alert-subscriptions';
import sendEventAlertsHandler from './api/send-event-alerts';
var LOCAL_API_HANDLERS = new Map([
    ['/api/event-alert-subscriptions', eventAlertSubscriptionsHandler],
    ['/api/send-event-alerts', sendEventAlertsHandler]
]);
function readRequestBody(request) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        request.on('data', function (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        request.on('end', function () {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
        request.on('error', reject);
    });
}
function readQueryParams(url) {
    var query = {};
    url.searchParams.forEach(function (value, key) {
        var current = query[key];
        if (typeof current === 'undefined') {
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
function createResponseAdapter(response) {
    return {
        setHeader: function (name, value) {
            response.setHeader(name, value);
        },
        status: function (code) {
            response.statusCode = code;
            return this;
        },
        json: function (payload) {
            if (!response.headersSent) {
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            response.end(JSON.stringify(payload));
        },
        send: function (payload) {
            response.end(typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
        },
        end: function (payload) {
            response.end(payload);
        }
    };
}
function attachLocalApiMiddleware(server) {
    var _this = this;
    server.middlewares.use(function (request, response, next) { return __awaiter(_this, void 0, void 0, function () {
        var url, handler, body, _a, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!request.url) {
                        next();
                        return [2 /*return*/];
                    }
                    url = new URL(request.url, 'https://localhost');
                    handler = LOCAL_API_HANDLERS.get(url.pathname);
                    if (!handler) {
                        next();
                        return [2 /*return*/];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, , 7]);
                    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes((_b = request.method) !== null && _b !== void 0 ? _b : '')) return [3 /*break*/, 3];
                    return [4 /*yield*/, readRequestBody(request)];
                case 2:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = undefined;
                    _c.label = 4;
                case 4:
                    body = _a;
                    return [4 /*yield*/, handler({
                            method: request.method,
                            body: body,
                            query: readQueryParams(url),
                            headers: request.headers
                        }, createResponseAdapter(response))];
                case 5:
                    _c.sent();
                    if (!response.writableEnded) {
                        response.end();
                    }
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _c.sent();
                    next(error_1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); });
}
function localApiPlugin() {
    return {
        name: 'local-event-alert-api',
        configureServer: function (server) {
            attachLocalApiMiddleware(server);
        },
        configurePreviewServer: function (server) {
            attachLocalApiMiddleware(server);
        }
    };
}
export default defineConfig({
    plugins: [react(), basicSsl(), localApiPlugin()],
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
    },
    server: {
        port: 5174,
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
            '/ethos-api': {
                target: 'https://api.ethos.network',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/ethos-api/, '/api/v2'); },
                secure: true,
                cookieDomainRewrite: '',
                cookiePathRewrite: '/',
            },
        },
    }
});
