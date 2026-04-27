var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
import { randomUUID } from 'node:crypto';
import { APP_EVENTS } from '../src/data/appEvents';
import { ETHOS_PROFILE_OVERRIDES } from '../src/data/ethosManualProfiles';
import rawProjects from '../src/data/projects.json';
var PROJECTS = rawProjects;
var ETHOS_BY_PROJECT_ID = new Map(ETHOS_PROFILE_OVERRIDES.filter(function (entry) { return entry.projectId; }).map(function (entry) { return [
    entry.projectId,
    {
        score: entry.score,
        tier: entry.tier,
        url: entry.url
    }
]; }));
var DEFAULT_MODEL = 'gpt-4.1-mini';
var DEFAULT_BASE_URL = 'https://api.openai.com/v1';
var DEFAULT_SUGGESTED_PROMPTS = [
    'Which lending protocol looks strongest on MegaETH right now?',
    'Compare the safest DeFi options for a new user.',
    'Which bridge should I use to move into MegaETH?',
    'Which mobile-first app should I try first?',
    'How does MegaETH differ from a typical Ethereum L2?'
];
var GENERAL_MEGAETH_CONTEXT = [
    'MegaETH is presented in its official docs as a high-performance Ethereum L2 and the first real-time blockchain.',
    'Official site claims include 100,000+ transactions per second, 10+ Ggas per second, and sub-10 ms block times.',
    'Official docs describe mini-blocks every ~10 ms for fast confirmations and standard EVM blocks every ~1 second for Ethereum compatibility.',
    'Architecture docs say the sequencer executes transactions, streams mini-block results to RPC nodes, and settles to Ethereum L1.',
    'MegaETH docs say block data is posted via EigenDA and disputes are resolved on Ethereum using the OP Stack fault-proof framework, with Kailua mentioned as the ZK fraud-proof system.',
    'MegaETH docs emphasize real-time UX for trading, gaming, live feeds, and apps that need millisecond-level responsiveness.',
    'The current MegaBunnish context does not provide a verified numeric token supply. If asked for supply, say the current context does not specify it.'
].join('\n');
var AiAdvisorConfigError = /** @class */ (function (_super) {
    __extends(AiAdvisorConfigError, _super);
    function AiAdvisorConfigError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AiAdvisorConfigError;
}(Error));
export { AiAdvisorConfigError };
function isLocalBaseUrl(baseUrl) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl);
}
function isAnthropicBaseUrl(baseUrl) {
    return /anthropic\.com/i.test(baseUrl);
}
var normalize = function (value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};
var tokenize = function (value) { return normalize(value).split(/\s+/).filter(Boolean); };
var buildCorpus = function (project) {
    var _a, _b;
    return normalize(__spreadArray(__spreadArray(__spreadArray(__spreadArray([
        project.name,
        project.id
    ], project.categories, true), project.networks, true), [
        (_a = project.jojoInsight) !== null && _a !== void 0 ? _a : ''
    ], false), ((_b = project.incentives) !== null && _b !== void 0 ? _b : []).flatMap(function (entry) { return [entry.title, entry.reward]; }), true).join(' '));
};
function detectIntent(query) {
    var normalized = normalize(query);
    var categories = new Set();
    var wantsGeneralChainInfo = /(megaeth|chain|network|mainnet|l2|ethereum|throughput|tps|ggas|latency|block ?time|mini block|miniblock|realtime|real time|architecture|sequencer|settlement|eigenda|op stack|kailua|supply|token|tge|capacity|capabilities)/.test(normalized);
    if (/(lend|lending|borrow|loan|yield|farm|stable|money market|credit)/.test(normalized)) {
        categories.add('DeFi');
    }
    if (/(bridge|bridg|transfer|onramp|offramp)/.test(normalized)) {
        categories.add('Bridge');
    }
    if (/(trade|trading|perp|perps|options|dex|swap|market making)/.test(normalized)) {
        categories.add('Trading');
    }
    if (/(mobile|iphone|android|app store|play store)/.test(normalized)) {
        categories.add('Mobile');
    }
    if (/(ai|agent|agents|autonomous)/.test(normalized)) {
        categories.add('AI');
    }
    if (!categories.size && !wantsGeneralChainInfo) {
        categories.add('DeFi');
    }
    return {
        categories: Array.from(categories),
        strictLending: /(lend|lending|borrow|loan|credit)/.test(normalized),
        strictBridge: /(bridge|bridg|transfer|onramp|offramp)/.test(normalized),
        strictTrading: /(trade|trading|perp|perps|options|dex|swap)/.test(normalized),
        strictMobile: /(mobile|iphone|android)/.test(normalized),
        strictAi: /(ai|agent|agents|autonomous)/.test(normalized),
        preferLive: /(live|now|active|today|current|right now)/.test(normalized),
        preferIncentives: /(farm|yield|points|reward|incentive)/.test(normalized),
        preferSafety: /(safe|safest|safety|secure|securest|trusted|trust|reliable|risk|risky)/.test(normalized),
        preferBeginnerFriendly: /(new user|beginner|first time|first-time|starter|easy|simple)/.test(normalized),
        wantsGeneralChainInfo: wantsGeneralChainInfo,
        keywords: tokenize(query)
    };
}
function buildReason(project, corpus, intent, event) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var ethos = ETHOS_BY_PROJECT_ID.get(project.id);
    var ethosNote = ethos
        ? " Ethos trust score: ".concat(ethos.score).concat(ethos.tier ? " (".concat(ethos.tier, ")") : '', ".")
        : '';
    if (intent.strictLending && /lending|borrow|loan|credit/.test(corpus)) {
        return ((_a = project.jojoInsight) !== null && _a !== void 0 ? _a : 'Explicitly positioned around lending and borrowing in the current MegaBunnish data.') + ethosNote;
    }
    if (intent.strictBridge && project.categories.includes('Bridge')) {
        return ((_b = project.jojoInsight) !== null && _b !== void 0 ? _b : 'Bridge-focused project in the MegaETH ecosystem dataset.') + ethosNote;
    }
    if (intent.strictTrading && project.categories.includes('Trading')) {
        return ((_c = project.jojoInsight) !== null && _c !== void 0 ? _c : 'Trading-focused project with a clear product thesis in the dataset.') + ethosNote;
    }
    if (intent.strictMobile && project.categories.includes('Mobile')) {
        return ((_d = project.jojoInsight) !== null && _d !== void 0 ? _d : 'Mobile-oriented product in the current MegaETH ecosystem list.') + ethosNote;
    }
    if (intent.strictAi && project.categories.includes('AI')) {
        return ((_e = project.jojoInsight) !== null && _e !== void 0 ? _e : 'AI project with a differentiated angle in the current dataset.') + ethosNote;
    }
    if ((_f = project.incentives) === null || _f === void 0 ? void 0 : _f.length) {
        return "Visible incentive: ".concat(project.incentives[0].title, ".").concat(ethosNote);
    }
    if (event) {
        return "Relevant event: ".concat(event.title, ".").concat(ethosNote);
    }
    return ((_g = project.jojoInsight) !== null && _g !== void 0 ? _g : "".concat(project.name, " is a relevant ").concat((_h = project.categories[0]) !== null && _h !== void 0 ? _h : 'ecosystem', " project in the current site data.")) + ethosNote;
}
function findBestEvent(projectId, nowMs) {
    var _a, _b;
    var entries = APP_EVENTS.filter(function (event) { return event.projectId === projectId; })
        .map(function (event) {
        var startMs = new Date(event.start).getTime();
        var endMs = event.end ? new Date(event.end).getTime() : startMs;
        var isActive = startMs <= nowMs && endMs >= nowMs;
        var isUpcoming = startMs > nowMs;
        if (!isActive && !isUpcoming) {
            return null;
        }
        return {
            event: event,
            weight: isActive ? 2 : 1,
            distance: isActive ? 0 : startMs - nowMs
        };
    })
        .filter(function (entry) { return Boolean(entry); })
        .sort(function (left, right) { return right.weight - left.weight || left.distance - right.distance; });
    return (_b = (_a = entries[0]) === null || _a === void 0 ? void 0 : _a.event) !== null && _b !== void 0 ? _b : null;
}
function scoreProject(project, query, intent) {
    var _a, _b, _c;
    var corpus = buildCorpus(project);
    var normalizedQuery = normalize(query);
    var event = findBestEvent(project.id, Date.now());
    var ethos = ETHOS_BY_PROJECT_ID.get(project.id);
    var score = 0;
    if (intent.categories.some(function (category) { return project.categories.includes(category); })) {
        score += 30;
    }
    if (project.isLive) {
        score += 12;
    }
    if ((_a = project.incentives) === null || _a === void 0 ? void 0 : _a.length) {
        score += 12;
    }
    if (event) {
        score += 8;
    }
    var matchedKeywords = intent.keywords.filter(function (token) { return token.length > 2 && corpus.includes(token); });
    score += Math.min(18, matchedKeywords.length * 3);
    if (ethos) {
        score += Math.max(0, Math.min(18, Math.round((ethos.score - 1100) / 40)));
    }
    if (intent.strictLending) {
        if (/lending|borrow|loan|credit/.test(corpus)) {
            score += 40;
        }
        else if (project.categories.includes('DeFi')) {
            score += intent.preferIncentives && ((_b = project.incentives) === null || _b === void 0 ? void 0 : _b.length) ? 10 : -6;
        }
        else {
            score -= 20;
        }
    }
    if (intent.strictBridge) {
        score += project.categories.includes('Bridge') ? 36 : -18;
    }
    if (intent.strictTrading) {
        score += project.categories.includes('Trading') ? 32 : -14;
    }
    if (intent.strictMobile) {
        score += project.categories.includes('Mobile') ? 28 : -12;
    }
    if (intent.strictAi) {
        score += project.categories.includes('AI') ? 28 : -12;
    }
    if (intent.preferLive && !project.isLive && !((_c = project.incentives) === null || _c === void 0 ? void 0 : _c.length) && !event) {
        score -= 8;
    }
    if (intent.preferSafety || intent.preferBeginnerFriendly) {
        if (ethos) {
            if (ethos.score >= 1600) {
                score += 28;
            }
            else if (ethos.score >= 1400) {
                score += 18;
            }
            else if (ethos.score >= 1200) {
                score += 8;
            }
            else {
                score -= 10;
            }
        }
        else {
            score -= 6;
        }
        if (project.categories.includes('Bridge') || project.categories.includes('DeFi')) {
            score += 4;
        }
    }
    if (score < 18) {
        return null;
    }
    return {
        project: project,
        score: score,
        reason: buildReason(project, corpus, intent, event)
    };
}
function selectProjects(message, history) {
    var query = __spreadArray(__spreadArray([], history.filter(function (entry) { return entry.role === 'user'; }).slice(-2).map(function (entry) { return entry.content; }), true), [message], false).join(' ');
    var intent = detectIntent(query);
    if (intent.wantsGeneralChainInfo && intent.categories.length === 0) {
        return [];
    }
    return PROJECTS
        .map(function (project) { return scoreProject(project, query, intent); })
        .filter(function (entry) { return Boolean(entry); })
        .sort(function (left, right) { return right.score - left.score; })
        .slice(0, 6);
}
function buildContextBlock(projects) {
    var eventIds = new Set();
    var nowMs = Date.now();
    var lines = projects.map(function (_a) {
        var _b, _c;
        var project = _a.project, reason = _a.reason;
        var event = findBestEvent(project.id, nowMs);
        var ethos = ETHOS_BY_PROJECT_ID.get(project.id);
        if (event) {
            eventIds.add(event.id);
        }
        return [
            "Project: ".concat(project.name, " (").concat(project.id, ")"),
            "Categories: ".concat(project.categories.join(', ')),
            "Live: ".concat(project.isLive ? 'yes' : 'no'),
            "Ethos trust: ".concat(ethos ? "".concat(ethos.score).concat(ethos.tier ? " (".concat(ethos.tier, ")") : '').concat(ethos.url ? " | ".concat(ethos.url) : '') : 'not available'),
            "Incentives: ".concat(((_b = project.incentives) === null || _b === void 0 ? void 0 : _b.map(function (entry) { return entry.title; }).join(' | ')) || 'none visible'),
            "Research note: ".concat((_c = project.jojoInsight) !== null && _c !== void 0 ? _c : 'No extra editorial note available.'),
            "Event: ".concat(event ? "".concat(event.title, " (").concat(event.start).concat(event.end ? " -> ".concat(event.end) : '', ")") : 'none active or upcoming'),
            "Why selected: ".concat(reason)
        ].join('\n');
    });
    var sections = ["MegaETH chain context:\n".concat(GENERAL_MEGAETH_CONTEXT)];
    if (lines.length) {
        sections.push("Relevant ecosystem projects:\n\n".concat(lines.join('\n\n')));
    }
    return {
        text: sections.join('\n\n'),
        sourceEventIds: Array.from(eventIds)
    };
}
function sanitizeHistory(history) {
    return history
        .filter(function (entry) { return (entry.role === 'user' || entry.role === 'assistant') && entry.content.trim(); })
        .slice(-8)
        .map(function (entry) { return ({
        role: entry.role,
        content: entry.content.trim().slice(0, 1800)
    }); });
}
function readApiConfig() {
    var _a, _b, _c, _d;
    var baseUrl = (((_a = process.env.AI_ADVISOR_BASE_URL) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_BASE_URL).replace(/\/$/, '');
    var apiKey = (_b = process.env.AI_ADVISOR_API_KEY) === null || _b === void 0 ? void 0 : _b.trim();
    var model = ((_c = process.env.AI_ADVISOR_MODEL) === null || _c === void 0 ? void 0 : _c.trim()) || DEFAULT_MODEL;
    var configuredProvider = (_d = process.env.AI_ADVISOR_PROVIDER) === null || _d === void 0 ? void 0 : _d.trim().toLowerCase();
    var provider = configuredProvider === 'anthropic' || isAnthropicBaseUrl(baseUrl)
        ? 'anthropic'
        : 'openai-compatible';
    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
        throw new AiAdvisorConfigError('AI advisor is not configured. Set AI_ADVISOR_API_KEY, or point AI_ADVISOR_BASE_URL to a local OpenAI-compatible model endpoint such as Ollama.');
    }
    return {
        apiKey: apiKey,
        model: model,
        baseUrl: baseUrl,
        provider: provider
    };
}
function buildPrompt(message, history, contextText) {
    var systemPrompt = [
        'You are the MegaBunnish AI advisor for the MegaETH ecosystem.',
        'Answer in English only.',
        'Use only the provided MegaBunnish context and conversation history.',
        'Never invent incentives, launches, token plans, live status, or opinions not grounded in the provided data.',
        'If the evidence is weak, say that directly.',
        'Write in polished, natural prose with complete sentences.',
        'Use short, direct sentences that go straight to the point.',
        'Do not answer with compressed fragments, note dumps, telegraphic phrasing, or long clause chains.',
        'Lead with a clear conclusion, then explain the ranking or answer in well-written sentences.',
        'For any answer longer than three sentences, split the response into two or three short paragraphs with visible line breaks.',
        'Prefer short paragraphs of one to three sentences each.',
        'For comparison questions, mention the top options first and explain why each one fits in one or two complete sentences.',
        'When the user asks about safety, trust, reliability, or beginner-friendly choices, explicitly factor Ethos trust scores into the comparison, but do not rely on Ethos alone.',
        'When recommending projects, explain the distinction between explicit fit and broader fallback options when relevant.',
        'You are not limited to recommending apps. You can also answer general questions about MegaETH itself when the provided context covers them.',
        'Keep answers concise but useful, usually one short paragraph plus up to three bullet points if needed.'
    ].join(' ');
    var messages = __spreadArray(__spreadArray([
        { role: 'system', content: systemPrompt },
        { role: 'system', content: "MegaBunnish context:\n\n".concat(contextText) }
    ], history.map(function (entry) { return ({ role: entry.role, content: entry.content }); }), true), [
        { role: 'user', content: message }
    ], false);
    return messages;
}
function requestCompletion(messages) {
    return __awaiter(this, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            config = readApiConfig();
            if (config.provider === 'anthropic') {
                return [2 /*return*/, requestAnthropicCompletion(config, messages)];
            }
            return [2 /*return*/, requestOpenAiCompatibleCompletion(config, messages)];
        });
    });
}
function requestOpenAiCompatibleCompletion(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, body, payload, content, text;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    headers = {
                        'Content-Type': 'application/json'
                    };
                    if (config.apiKey) {
                        headers.Authorization = "Bearer ".concat(config.apiKey);
                    }
                    return [4 /*yield*/, fetch("".concat(config.baseUrl, "/chat/completions"), {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({
                                model: config.model,
                                temperature: 0.2,
                                messages: messages
                            })
                        })];
                case 1:
                    response = _d.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    body = _d.sent();
                    throw new Error("AI advisor request failed (".concat(response.status, "): ").concat(body || response.statusText));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    payload = (_d.sent());
                    content = (_c = (_b = (_a = payload.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
                    if (typeof content === 'string') {
                        return [2 /*return*/, content.trim()];
                    }
                    if (Array.isArray(content)) {
                        text = content
                            .map(function (entry) { var _a; return (entry.type === 'text' || !entry.type ? (_a = entry.text) !== null && _a !== void 0 ? _a : '' : ''); })
                            .join('')
                            .trim();
                        if (text) {
                            return [2 /*return*/, text];
                        }
                    }
                    throw new Error('AI advisor returned an empty response.');
            }
        });
    });
}
function requestAnthropicCompletion(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var systemMessages, userAssistantMessages, systemPrompt, response, body, payload, text;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!config.apiKey) {
                        throw new AiAdvisorConfigError('Anthropic requires AI_ADVISOR_API_KEY.');
                    }
                    systemMessages = messages.filter(function (entry) { return entry.role === 'system'; });
                    userAssistantMessages = messages.filter(function (entry) { return entry.role !== 'system'; });
                    systemPrompt = systemMessages.map(function (entry) { return entry.content; }).join('\n\n');
                    return [4 /*yield*/, fetch("".concat(config.baseUrl, "/messages"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-key': config.apiKey,
                                'anthropic-version': '2023-06-01'
                            },
                            body: JSON.stringify({
                                model: config.model,
                                max_tokens: 700,
                                temperature: 0.2,
                                system: systemPrompt,
                                messages: userAssistantMessages.map(function (entry) { return ({
                                    role: entry.role,
                                    content: entry.content
                                }); })
                            })
                        })];
                case 1:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    body = _b.sent();
                    throw new Error("AI advisor request failed (".concat(response.status, "): ").concat(body || response.statusText));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    payload = (_b.sent());
                    text = (_a = payload.content) === null || _a === void 0 ? void 0 : _a.map(function (entry) { var _a; return (entry.type === 'text' || !entry.type ? (_a = entry.text) !== null && _a !== void 0 ? _a : '' : ''); }).join('').trim();
                    if (!text) {
                        throw new Error('AI advisor returned an empty response.');
                    }
                    return [2 /*return*/, text];
            }
        });
    });
}
export function generateAiAdvisorReply(input) {
    return __awaiter(this, void 0, void 0, function () {
        var message, history, rankedProjects, context, promptMessages, answer;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    message = input.message.trim();
                    if (!message) {
                        throw new Error('Message is required.');
                    }
                    history = sanitizeHistory((_a = input.history) !== null && _a !== void 0 ? _a : []);
                    rankedProjects = selectProjects(message, history);
                    context = buildContextBlock(rankedProjects);
                    promptMessages = buildPrompt(message, history, context.text);
                    return [4 /*yield*/, requestCompletion(promptMessages)];
                case 1:
                    answer = _c.sent();
                    return [2 /*return*/, {
                            answer: answer,
                            conversationId: ((_b = input.conversationId) === null || _b === void 0 ? void 0 : _b.trim()) || randomUUID(),
                            recommendations: rankedProjects.slice(0, 4).map(function (_a) {
                                var project = _a.project, reason = _a.reason;
                                return ({
                                    projectId: project.id,
                                    reason: reason
                                });
                            }),
                            sourceProjectIds: rankedProjects.map(function (_a) {
                                var project = _a.project;
                                return project.id;
                            }),
                            sourceEventIds: context.sourceEventIds,
                            suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS
                        }];
            }
        });
    });
}
