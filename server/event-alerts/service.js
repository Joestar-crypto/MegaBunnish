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
var _a, _b, _c, _d;
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import rawProjects from '../../src/data/projects.json';
import { APP_EVENTS } from '../../src/data/appEvents';
import { Resend } from 'resend';
import { buildEventAlertBroadcastName, ensureEventAlertStorage, ensureResendEventAlertTarget, getDeliveredEmailsForEvent, getEventAlertsSnapshot, recordEventAlertDelivery, subscribeEventAlertSubscriber, unsubscribeEventAlertSubscriber } from './store';
var DEFAULT_FROM_ADDRESS = (_a = process.env.RESEND_FROM_ADDRESS) !== null && _a !== void 0 ? _a : 'Megabunnish <onboarding@resend.dev>';
var EVENT_ALERTS_BASE_URL = ((_c = (_b = process.env.EVENT_ALERTS_BASE_URL) !== null && _b !== void 0 ? _b : process.env.EVENTS_BASE_URL) !== null && _c !== void 0 ? _c : '').replace(/\/$/, '');
var EVENT_ALERTS_API_BASE_URL = ((_d = process.env.EVENT_ALERTS_API_BASE_URL) !== null && _d !== void 0 ? _d : EVENT_ALERTS_BASE_URL).replace(/\/$/, '');
var TEMPLATE_PATH = fileURLToPath(new URL('../../emails/resend-news-template.html', import.meta.url));
var TEMPLATE_HTML = readFileSync(TEMPLATE_PATH, 'utf8');
var EVENT_TIMEZONE = 'America/New_York';
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
var SEND_BATCH_SIZE = 10;
var EventAlertsConfigError = /** @class */ (function (_super) {
    __extends(EventAlertsConfigError, _super);
    function EventAlertsConfigError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'EventAlertsConfigError';
        return _this;
    }
    return EventAlertsConfigError;
}(Error));
export { EventAlertsConfigError };
var projects = rawProjects;
var projectById = new Map(projects.map(function (project) { return [project.id, project]; }));
var DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: EVENT_TIMEZONE
});
var SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: EVENT_TIMEZONE
});
var TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EVENT_TIMEZONE
});
function getResendClient() {
    var apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new EventAlertsConfigError('Missing RESEND_API_KEY.');
    }
    return new Resend(apiKey);
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
export function isValidEventAlertEmail(email) {
    return EMAIL_PATTERN.test(normalizeEmail(email));
}
function readResendErrorMessage(error) {
    var _a;
    var resendError = error;
    return (_a = resendError === null || resendError === void 0 ? void 0 : resendError.message) !== null && _a !== void 0 ? _a : 'Unexpected Resend error.';
}
function getAbsoluteUrl(pathOrUrl) {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    if (!EVENT_ALERTS_BASE_URL) {
        throw new EventAlertsConfigError('Missing EVENT_ALERTS_BASE_URL or EVENTS_BASE_URL for event alert rendering.');
    }
    return "".concat(EVENT_ALERTS_BASE_URL).concat(pathOrUrl.startsWith('/') ? pathOrUrl : "/".concat(pathOrUrl));
}
function getEventAlertApiUrl(pathOrUrl) {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    if (!EVENT_ALERTS_API_BASE_URL) {
        throw new EventAlertsConfigError('Missing EVENT_ALERTS_API_BASE_URL, EVENT_ALERTS_BASE_URL, or EVENTS_BASE_URL for event alert API links.');
    }
    return "".concat(EVENT_ALERTS_API_BASE_URL).concat(pathOrUrl.startsWith('/') ? pathOrUrl : "/".concat(pathOrUrl));
}
function toCalendarDateString(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
function formatTimeLabel(value) {
    return TIME_FORMATTER.format(new Date(value));
}
function formatEventDateRange(start, end) {
    var startDate = new Date(start);
    var endDate = end ? new Date(end) : null;
    var startLabel = DATE_FORMATTER.format(startDate);
    if (!endDate || Number.isNaN(endDate.getTime())) {
        return startLabel;
    }
    var endLabel = DATE_FORMATTER.format(endDate);
    return startLabel === endLabel ? startLabel : "".concat(startLabel, " -> ").concat(endLabel);
}
function formatEventTimeRange(start, end) {
    var startTime = formatTimeLabel(start);
    var endTime = formatTimeLabel(end);
    var isAllDay = startTime === '12:00 AM' && endTime === '11:59 PM';
    return isAllDay ? '' : "".concat(startTime, "-").concat(endTime);
}
function isAllDayEvent(event) {
    return event.phases.length === 1 && event.phases[0].label.toLowerCase() === 'all day';
}
function formatPrimaryTimeLabel(event) {
    if (isAllDayEvent(event)) {
        return 'All day';
    }
    if (!event.end) {
        return formatTimeLabel(event.start);
    }
    var startLabel = SHORT_DATE_FORMATTER.format(new Date(event.start));
    var endLabel = SHORT_DATE_FORMATTER.format(new Date(event.end));
    if (startLabel === endLabel) {
        return formatEventTimeRange(event.start, event.end) || 'All day';
    }
    return "".concat(formatTimeLabel(event.start), " -> ").concat(formatTimeLabel(event.end));
}
function buildGoogleCalendarUrl(event, projectName) {
    var _a, _b;
    var end = (_a = event.end) !== null && _a !== void 0 ? _a : event.start;
    var phaseLines = event.phases
        .map(function (phase) { return "".concat(phase.label, ": ").concat(formatEventDateRange(phase.start, phase.end)); })
        .join('\n');
    var params = new URLSearchParams({
        action: 'TEMPLATE',
        text: "".concat(projectName, " - ").concat(event.title),
        dates: "".concat(toCalendarDateString(event.start), "/").concat(toCalendarDateString(end)),
        details: "".concat(event.title, "\n").concat(phaseLines ? "\n".concat(phaseLines, "\n") : '', "\nDetails: ").concat((_b = event.detailsUrl) !== null && _b !== void 0 ? _b : event.tweetUrl),
        ctz: EVENT_TIMEZONE
    });
    return "https://calendar.google.com/calendar/render?".concat(params.toString());
}
function fillTemplate(template, variables) {
    return template.replace(/\{\{\{([A-Z0-9_]+)\}\}\}/g, function (_match, key) { var _a; return (_a = variables[key]) !== null && _a !== void 0 ? _a : ''; });
}
function buildTimelineSectionHtml(event) {
    var timedPhases = event.phases.filter(function (phase) { return phase.label.toLowerCase() !== 'all day'; });
    if (!timedPhases.length) {
        return '';
    }
    var rows = timedPhases
        .map(function (phase) {
        var timeLabel = formatEventTimeRange(phase.start, phase.end);
        return "\n          <tr>\n            <td style=\"padding:10px 14px;font-weight:700;color:#fff7df;border-bottom:1px solid rgba(255,255,255,0.08);\">".concat(escapeHtml(phase.label), "</td>\n            <td style=\"padding:10px 14px;color:rgba(255,244,214,0.72);border-bottom:1px solid rgba(255,255,255,0.08);\">").concat(escapeHtml(timeLabel || formatEventDateRange(phase.start, phase.end)), "</td>\n          </tr>");
    })
        .join('');
    return "\n          <tr>\n            <td style=\"padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);\">\n              <div style=\"font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#d2bb77;margin-bottom:10px;font-weight:700;\">\n                Schedule\n              </div>\n              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#1a1511;border-radius:16px;border:1px solid rgba(255,216,77,0.12);font-size:13px;overflow:hidden;\">\n                ".concat(rows, "\n              </table>\n            </td>\n          </tr>");
}
function buildSecondaryCtaHtml(calendarUrl) {
    return "<td><a href=\"".concat(escapeHtml(calendarUrl), "\" style=\"display:inline-block;border:1px solid rgba(255,255,255,0.18);background:#1a1511;color:#fff7df;font-weight:700;font-size:14px;text-decoration:none;padding:13px 20px;border-radius:999px;\">Add to Calendar</a></td>");
}
function buildProjectLinkHtml(project) {
    var _a;
    if (!((_a = project.links) === null || _a === void 0 ? void 0 : _a.site)) {
        return '';
    }
    return "<tr><td style=\"padding:16px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);\"><a href=\"".concat(escapeHtml(project.links.site), "\" style=\"font-size:13px;color:#d9ccff;text-decoration:none;font-weight:700;\">Visit ").concat(escapeHtml(project.name), " &#8594;</a></td></tr>");
}
function buildBroadcastSubject(event, project) {
    return "NEW EVENT ON MEGAETH | ".concat(project.name, " | ").concat(event.title);
}
function buildBroadcastPreviewText(event, project) {
    return "".concat(project.name, " just announced ").concat(event.title, " on MegaETH.");
}
function getUnsubscribeSecret() {
    var _a, _b;
    var secret = (_b = (_a = process.env.EVENT_ALERTS_UNSUBSCRIBE_SECRET) !== null && _a !== void 0 ? _a : process.env.EVENT_ALERTS_CRON_SECRET) !== null && _b !== void 0 ? _b : process.env.RESEND_API_KEY;
    if (!secret) {
        throw new EventAlertsConfigError('Missing EVENT_ALERTS_UNSUBSCRIBE_SECRET, EVENT_ALERTS_CRON_SECRET, or RESEND_API_KEY for unsubscribe links.');
    }
    return secret;
}
function buildUnsubscribeToken(email) {
    return createHmac('sha256', getUnsubscribeSecret())
        .update(normalizeEmail(email))
        .digest('hex');
}
function buildEventAlertUnsubscribeUrl(email) {
    var params = new URLSearchParams({
        email: normalizeEmail(email),
        token: buildUnsubscribeToken(email),
        action: 'unsubscribe'
    });
    return "".concat(getEventAlertApiUrl('/api/event-alert-subscriptions'), "?").concat(params.toString());
}
function buildEventAlertUnsubscribeConfirmationUrl(email) {
    var params = new URLSearchParams({
        email: normalizeEmail(email),
        token: buildUnsubscribeToken(email),
        action: 'confirm'
    });
    return "".concat(getEventAlertApiUrl('/api/event-alert-subscriptions'), "?").concat(params.toString());
}
export function verifyEventAlertUnsubscribeToken(email, token) {
    var normalizedEmail = normalizeEmail(email);
    var expected = buildUnsubscribeToken(normalizedEmail);
    var expectedBuffer = Buffer.from(expected, 'utf8');
    var actualBuffer = Buffer.from(token, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
}
function buildBroadcastText(event, project, recipientEmail) {
    var _a, _b;
    var detailsUrl = (_a = event.detailsUrl) !== null && _a !== void 0 ? _a : event.tweetUrl;
    var lines = [
        'NEW EVENT ON MEGAETH',
        '',
        "".concat(project.name, " - ").concat(event.title),
        "".concat(formatEventDateRange(event.start, event.end)).concat(isAllDayEvent(event) ? '' : " | ".concat(formatPrimaryTimeLabel(event))),
        '',
        "Details: ".concat(detailsUrl)
    ];
    var timedPhases = event.phases.filter(function (phase) { return phase.label.toLowerCase() !== 'all day'; });
    if (timedPhases.length) {
        lines.push('', 'Schedule:');
        timedPhases.forEach(function (phase) {
            lines.push("- ".concat(phase.label, ": ").concat(formatEventTimeRange(phase.start, phase.end) || formatEventDateRange(phase.start, phase.end)));
        });
    }
    if ((_b = project.links) === null || _b === void 0 ? void 0 : _b.site) {
        lines.push('', "Project: ".concat(project.links.site));
    }
    if (recipientEmail) {
        lines.push('', "Unsubscribe: ".concat(buildEventAlertUnsubscribeConfirmationUrl(recipientEmail)));
    }
    else {
        lines.push('', "Manage alerts: ".concat(getAbsoluteUrl('/')));
    }
    return lines.join('\n');
}
function renderBroadcastHtml(event, project, recipientEmail) {
    var _a, _b, _c, _d, _e, _f, _g;
    var detailsUrl = (_a = event.detailsUrl) !== null && _a !== void 0 ? _a : event.tweetUrl;
    var actionUrl = recipientEmail ? buildEventAlertUnsubscribeConfirmationUrl(recipientEmail) : getAbsoluteUrl('/');
    var footerNote = recipientEmail
        ? isAllDayEvent(event)
            ? 'This event is scheduled as an all-day window.'
            : 'Watch the schedule closely in case additional phases get announced.'
        : 'Manage your event alerts from the Megabunnish Events panel.';
    var variables = {
        ECOSYSTEM_MAP_URL: getAbsoluteUrl('/Twittercard.png'),
        MEGABUNNISH_SYMBOL_URL: getAbsoluteUrl('/logos/Megabunnish.webp'),
        ECOSYSTEM_BADGE_TEXT: 'MegaETH Ecosystem Map',
        HERO_SUMMARY: escapeHtml("".concat(project.name, " just lit up on the MegaETH ecosystem map. Save the date, review the timing, and jump into the official announcement below.")),
        HERO_SOURCE_NOTE: 'Source: Megabunnish snapshot',
        PROJECT_NAME: escapeHtml(project.name),
        PROJECT_HANDLE: escapeHtml(((_d = (_c = (_b = project.links) === null || _b === void 0 ? void 0 : _b.twitter) === null || _c === void 0 ? void 0 : _c.split('/').filter(Boolean).pop()) !== null && _d !== void 0 ? _d : project.name).replace(/^@/, '')),
        PROJECT_TWITTER_URL: escapeHtml((_f = (_e = project.links) === null || _e === void 0 ? void 0 : _e.twitter) !== null && _f !== void 0 ? _f : detailsUrl),
        PROJECT_LOGO_URL: escapeHtml(getAbsoluteUrl((_g = project.logo) !== null && _g !== void 0 ? _g : '/logos/MegaETH.webp')),
        NEWS_LABEL: 'Event',
        NEWS_TITLE: escapeHtml(event.title),
        NEWS_BODY: escapeHtml("Track the latest move from ".concat(project.name, " on MegaETH. The key timing and useful links are right below.")),
        FACT_1_LABEL: 'Date',
        FACT_1_VALUE: escapeHtml(formatEventDateRange(event.start, event.end)),
        FACT_2_LABEL: 'Time',
        FACT_2_VALUE: escapeHtml(formatPrimaryTimeLabel(event)),
        TIMELINE_SECTION_HTML: buildTimelineSectionHtml(event),
        PRIMARY_CTA_LABEL: 'View Details',
        PRIMARY_CTA_URL: escapeHtml(detailsUrl),
        SECONDARY_CTA_HTML: buildSecondaryCtaHtml(buildGoogleCalendarUrl(event, project.name)),
        PROJECT_LINK_HTML: buildProjectLinkHtml(project),
        FOOTER_NOTE: footerNote,
        FOOTER_ACTION_LABEL: recipientEmail ? 'Unsubscribe' : 'Manage alerts',
        UNSUBSCRIBE_URL: escapeHtml(actionUrl)
    };
    return fillTemplate(TEMPLATE_HTML, variables);
}
function isUpcomingEvent(event) {
    var _a;
    var endValue = (_a = event.end) !== null && _a !== void 0 ? _a : event.start;
    return new Date(endValue).getTime() > Date.now();
}
function chunkValues(values, size) {
    var batches = [];
    for (var index = 0; index < values.length; index += size) {
        batches.push(values.slice(index, index + size));
    }
    return batches;
}
function normalizeRequestedEventIds(eventIds) {
    return Array.from(new Set((eventIds !== null && eventIds !== void 0 ? eventIds : []).map(function (eventId) { return eventId.trim(); }).filter(Boolean)));
}
export function subscribeToEventAlerts(email) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedEmail;
        return __generator(this, function (_a) {
            normalizedEmail = normalizeEmail(email);
            if (!isValidEventAlertEmail(normalizedEmail)) {
                throw new EventAlertsConfigError('Please enter a valid email address.');
            }
            return [2 /*return*/, subscribeEventAlertSubscriber(normalizedEmail, 'events_panel')];
        });
    });
}
export function unsubscribeFromEventAlerts(email) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedEmail;
        return __generator(this, function (_a) {
            normalizedEmail = normalizeEmail(email);
            if (!isValidEventAlertEmail(normalizedEmail)) {
                throw new EventAlertsConfigError('Please enter a valid email address.');
            }
            return [2 /*return*/, unsubscribeEventAlertSubscriber(normalizedEmail)];
        });
    });
}
export function getEventAlertsStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var snapshot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getEventAlertsSnapshot()];
                case 1:
                    snapshot = _a.sent();
                    return [2 /*return*/, {
                            storageDriver: snapshot.storageDriver,
                            activeSubscriberCount: snapshot.activeSubscribers.length,
                            subscribers: snapshot.subscribers,
                            deliveries: snapshot.deliveries
                        }];
            }
        });
    });
}
function createConfirmationHtml(email) {
    var unsubscribeUrl = buildEventAlertUnsubscribeUrl(email);
    var escapedEmail = escapeHtml(email);
    return "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>Manage event alerts</title>\n  </head>\n  <body style=\"margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;\">\n    <div style=\"max-width:560px;margin:0 auto;padding:48px 24px;\">\n      <div style=\"background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;\">\n        <div style=\"font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;\">Megabunnish Event Alerts</div>\n        <h1 style=\"margin:14px 0 12px;font-size:28px;line-height:1.1;\">Unsubscribe ".concat(escapedEmail, "?</h1>\n        <p style=\"margin:0 0 20px;color:rgba(255,244,214,0.78);line-height:1.6;\">If you confirm, this email address will stop receiving new MegaETH ecosystem event announcements.</p>\n        <a href=\"").concat(escapeHtml(unsubscribeUrl), "\" style=\"display:inline-block;background:#f5c84c;color:#1b1206;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px;\">Confirm unsubscribe</a>\n      </div>\n    </div>\n  </body>\n</html>");
}
function createUnsubscribedHtml(email) {
    var escapedEmail = escapeHtml(email);
    return "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>Unsubscribed</title>\n  </head>\n  <body style=\"margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;\">\n    <div style=\"max-width:560px;margin:0 auto;padding:48px 24px;\">\n      <div style=\"background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;\">\n        <div style=\"font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;\">Megabunnish Event Alerts</div>\n        <h1 style=\"margin:14px 0 12px;font-size:28px;line-height:1.1;\">".concat(escapedEmail, " has been unsubscribed.</h1>\n        <p style=\"margin:0;color:rgba(255,244,214,0.78);line-height:1.6;\">You will no longer receive new event announcements unless you subscribe again from the Events panel.</p>\n      </div>\n    </div>\n  </body>\n</html>");
}
export function getEventAlertUnsubscribePage(email, shouldFinalize) {
    return shouldFinalize ? createUnsubscribedHtml(email) : createConfirmationHtml(email);
}
export function sendNewEventAlerts() {
    return __awaiter(this, arguments, void 0, function (options) {
        var snapshot, activeSubscribers, requestedEventIds, requestedEventIdSet, forceRequestedEvents, pendingEvents, sentEvents, failures, resend, target, _a, _i, pendingEvents_1, pendingEvent, event, recipientEmails, project, response, _loop_1, _b, pendingEvents_2, pendingEvent;
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, ensureEventAlertStorage()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, getEventAlertsSnapshot()];
                case 2:
                    snapshot = _c.sent();
                    activeSubscribers = snapshot.activeSubscriberEmails;
                    requestedEventIds = normalizeRequestedEventIds(options.eventIds);
                    requestedEventIdSet = new Set(requestedEventIds);
                    forceRequestedEvents = Boolean(options.force) && requestedEventIdSet.size > 0;
                    if (!activeSubscribers.length) {
                        return [2 /*return*/, {
                                dryRun: Boolean(options.dryRun),
                                storageDriver: snapshot.storageDriver,
                                subscriberCount: 0,
                                pendingEvents: [],
                                sentEvents: [],
                                failures: [],
                                skippedReason: 'No subscribers in event alerts storage.'
                            }];
                    }
                    pendingEvents = APP_EVENTS
                        .filter(isUpcomingEvent)
                        .filter(function (event) { return !requestedEventIdSet.size || requestedEventIdSet.has(event.id); })
                        .map(function (event) {
                        var deliveredEmails = forceRequestedEvents && requestedEventIdSet.has(event.id)
                            ? new Set()
                            : new Set(getDeliveredEmailsForEvent(snapshot.deliveries, event.id));
                        var recipientEmails = activeSubscribers.filter(function (email) { return !deliveredEmails.has(email); });
                        return {
                            event: event,
                            recipientEmails: recipientEmails
                        };
                    })
                        .filter(function (entry) { return entry.recipientEmails.length > 0; });
                    if (!pendingEvents.length) {
                        return [2 /*return*/, {
                                dryRun: Boolean(options.dryRun),
                                storageDriver: snapshot.storageDriver,
                                subscriberCount: activeSubscribers.length,
                                pendingEvents: [],
                                sentEvents: [],
                                failures: [],
                                skippedReason: requestedEventIds.length
                                    ? "No pending event alerts matched the requested event ids: ".concat(requestedEventIds.join(', '))
                                    : 'No pending event alerts to send.'
                            }];
                    }
                    sentEvents = [];
                    failures = [];
                    resend = options.dryRun ? null : getResendClient();
                    if (!(snapshot.storageDriver === 'resend-segment')) return [3 /*break*/, 10];
                    if (!options.dryRun) return [3 /*break*/, 3];
                    _a = null;
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, ensureResendEventAlertTarget()];
                case 4:
                    _a = _c.sent();
                    _c.label = 5;
                case 5:
                    target = _a;
                    _i = 0, pendingEvents_1 = pendingEvents;
                    _c.label = 6;
                case 6:
                    if (!(_i < pendingEvents_1.length)) return [3 /*break*/, 9];
                    pendingEvent = pendingEvents_1[_i];
                    event = pendingEvent.event, recipientEmails = pendingEvent.recipientEmails;
                    project = projectById.get(event.projectId);
                    if (!project) {
                        return [3 /*break*/, 8];
                    }
                    if (options.dryRun) {
                        sentEvents.push({
                            eventId: event.id,
                            attemptedCount: recipientEmails.length,
                            sentCount: 0,
                            failedCount: 0
                        });
                        return [3 /*break*/, 8];
                    }
                    return [4 /*yield*/, resend.broadcasts.create({
                            name: buildEventAlertBroadcastName(event.id),
                            segmentId: target.segmentId,
                            topicId: target.topicId,
                            from: DEFAULT_FROM_ADDRESS,
                            subject: buildBroadcastSubject(event, project),
                            previewText: buildBroadcastPreviewText(event, project),
                            html: renderBroadcastHtml(event, project, null),
                            text: buildBroadcastText(event, project, null),
                            send: true
                        })];
                case 7:
                    response = _c.sent();
                    if (response.error) {
                        throw new Error(readResendErrorMessage(response.error));
                    }
                    sentEvents.push({
                        eventId: event.id,
                        attemptedCount: recipientEmails.length,
                        sentCount: recipientEmails.length,
                        failedCount: 0
                    });
                    _c.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, {
                        dryRun: Boolean(options.dryRun),
                        storageDriver: snapshot.storageDriver,
                        subscriberCount: activeSubscribers.length,
                        pendingEvents: pendingEvents.map(function (entry) { return ({
                            eventId: entry.event.id,
                            recipientCount: entry.recipientEmails.length
                        }); }),
                        sentEvents: sentEvents,
                        failures: failures
                    }];
                case 10:
                    _loop_1 = function (pendingEvent) {
                        var event, recipientEmails, project, subject, deliveredEmails, resendEmailIds, failedEmails, _d, _e, recipientBatch, batchResults;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    event = pendingEvent.event, recipientEmails = pendingEvent.recipientEmails;
                                    project = projectById.get(event.projectId);
                                    if (!project) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (options.dryRun) {
                                        sentEvents.push({
                                            eventId: event.id,
                                            attemptedCount: recipientEmails.length,
                                            sentCount: 0,
                                            failedCount: 0
                                        });
                                        return [2 /*return*/, "continue"];
                                    }
                                    subject = buildBroadcastSubject(event, project);
                                    deliveredEmails = [];
                                    resendEmailIds = [];
                                    failedEmails = [];
                                    _d = 0, _e = chunkValues(recipientEmails, SEND_BATCH_SIZE);
                                    _f.label = 1;
                                case 1:
                                    if (!(_d < _e.length)) return [3 /*break*/, 4];
                                    recipientBatch = _e[_d];
                                    return [4 /*yield*/, Promise.all(recipientBatch.map(function (recipientEmail) { return __awaiter(_this, void 0, void 0, function () {
                                            var response;
                                            var _a, _b;
                                            return __generator(this, function (_c) {
                                                switch (_c.label) {
                                                    case 0: return [4 /*yield*/, resend.emails.send({
                                                            from: DEFAULT_FROM_ADDRESS,
                                                            to: [recipientEmail],
                                                            subject: subject,
                                                            html: renderBroadcastHtml(event, project, recipientEmail),
                                                            text: buildBroadcastText(event, project, recipientEmail),
                                                            headers: {
                                                                'List-Unsubscribe': "<".concat(buildEventAlertUnsubscribeConfirmationUrl(recipientEmail), ">"),
                                                                'X-Megabunnish-Event-Id': event.id
                                                            }
                                                        })];
                                                    case 1:
                                                        response = _c.sent();
                                                        if (response.error) {
                                                            return [2 /*return*/, {
                                                                    ok: false,
                                                                    email: recipientEmail,
                                                                    error: readResendErrorMessage(response.error)
                                                                }];
                                                        }
                                                        return [2 /*return*/, {
                                                                ok: true,
                                                                email: recipientEmail,
                                                                emailId: (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null
                                                            }];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    batchResults = _f.sent();
                                    batchResults.forEach(function (result) {
                                        if (result.ok) {
                                            deliveredEmails.push(result.email);
                                            if (result.emailId) {
                                                resendEmailIds.push(result.emailId);
                                            }
                                            return;
                                        }
                                        failedEmails.push({
                                            email: result.email,
                                            error: result.error
                                        });
                                    });
                                    _f.label = 3;
                                case 3:
                                    _d++;
                                    return [3 /*break*/, 1];
                                case 4: return [4 /*yield*/, recordEventAlertDelivery({
                                        eventId: event.id,
                                        subject: subject,
                                        deliveredEmails: deliveredEmails,
                                        resendEmailIds: resendEmailIds,
                                        failedEmails: failedEmails.map(function (entry) { return entry.email; }),
                                        attemptedCount: recipientEmails.length
                                    })];
                                case 5:
                                    _f.sent();
                                    failures.push.apply(failures, failedEmails.map(function (entry) { return ({
                                        eventId: event.id,
                                        email: entry.email,
                                        error: entry.error
                                    }); }));
                                    if (!deliveredEmails.length && failedEmails.length) {
                                        throw new Error("Unable to send event alert for ".concat(event.id, ": ").concat(failedEmails[0].error));
                                    }
                                    sentEvents.push({
                                        eventId: event.id,
                                        attemptedCount: recipientEmails.length,
                                        sentCount: deliveredEmails.length,
                                        failedCount: failedEmails.length
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, pendingEvents_2 = pendingEvents;
                    _c.label = 11;
                case 11:
                    if (!(_b < pendingEvents_2.length)) return [3 /*break*/, 14];
                    pendingEvent = pendingEvents_2[_b];
                    return [5 /*yield**/, _loop_1(pendingEvent)];
                case 12:
                    _c.sent();
                    _c.label = 13;
                case 13:
                    _b++;
                    return [3 /*break*/, 11];
                case 14: return [2 /*return*/, {
                        dryRun: Boolean(options.dryRun),
                        storageDriver: snapshot.storageDriver,
                        subscriberCount: activeSubscribers.length,
                        pendingEvents: pendingEvents.map(function (entry) { return ({
                            eventId: entry.event.id,
                            recipientCount: entry.recipientEmails.length
                        }); }),
                        sentEvents: sentEvents,
                        failures: failures
                    }];
            }
        });
    });
}
