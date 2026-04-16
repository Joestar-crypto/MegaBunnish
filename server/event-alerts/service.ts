import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import rawProjects from '../../src/data/projects.json';
import { APP_EVENTS, type AppEvent } from '../../src/data/appEvents';
import { Resend } from 'resend';

const EVENT_ALERTS_SEGMENT_NAME = process.env.EVENT_ALERTS_SEGMENT_NAME ?? 'Megabunnish Event Alerts';
const DEFAULT_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'Megabunnish <onboarding@resend.dev>';
const EVENT_ALERTS_BASE_URL = (process.env.EVENT_ALERTS_BASE_URL ?? process.env.EVENTS_BASE_URL ?? '').replace(/\/$/, '');
const TEMPLATE_PATH = fileURLToPath(new URL('../../emails/resend-news-template.html', import.meta.url));
const TEMPLATE_HTML = readFileSync(TEMPLATE_PATH, 'utf8');
const EVENT_TIMEZONE = 'America/New_York';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type Project = {
  id: string;
  name: string;
  logo?: string;
  links?: {
    site?: string;
    twitter?: string;
  };
};

type ContactErrorLike = {
  message?: string;
  statusCode?: number;
  name?: string;
};

type DispatchOptions = {
  dryRun?: boolean;
};

export class EventAlertsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventAlertsConfigError';
  }
}

const projects = rawProjects as Project[];
const projectById = new Map(projects.map((project) => [project.id, project]));

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: EVENT_TIMEZONE
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: EVENT_TIMEZONE
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: EVENT_TIMEZONE
});

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EventAlertsConfigError('Missing RESEND_API_KEY.');
  }

  return new Resend(apiKey);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEventAlertEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function readResendErrorMessage(error: unknown) {
  const resendError = error as ContactErrorLike | undefined;
  return resendError?.message ?? 'Unexpected Resend error.';
}

function isNotFoundError(error: unknown) {
  const resendError = error as ContactErrorLike | undefined;
  const message = resendError?.message?.toLowerCase() ?? '';
  return resendError?.statusCode === 404 || message.includes('not found');
}

function isConflictError(error: unknown) {
  const resendError = error as ContactErrorLike | undefined;
  const message = resendError?.message?.toLowerCase() ?? '';
  return resendError?.statusCode === 409 || message.includes('already exists') || message.includes('already in');
}

async function getOrCreateEventAlertsSegment(resend: Resend) {
  const listResponse = await resend.segments.list({ limit: 100 });
  if (listResponse.error) {
    throw new Error(readResendErrorMessage(listResponse.error));
  }

  const existing = listResponse.data?.data.find((segment) => segment.name === EVENT_ALERTS_SEGMENT_NAME);
  if (existing) {
    return existing;
  }

  const createResponse = await resend.segments.create({ name: EVENT_ALERTS_SEGMENT_NAME });
  if (createResponse.error || !createResponse.data) {
    throw new Error(readResendErrorMessage(createResponse.error));
  }

  return createResponse.data;
}

async function getExistingContactId(resend: Resend, email: string) {
  const response = await resend.contacts.get({ email });
  if (response.data?.id) {
    return response.data.id;
  }

  if (response.error && !isNotFoundError(response.error)) {
    throw new Error(readResendErrorMessage(response.error));
  }

  return null;
}

function getAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  if (!EVENT_ALERTS_BASE_URL) {
    throw new EventAlertsConfigError('Missing EVENT_ALERTS_BASE_URL or EVENTS_BASE_URL for event alert rendering.');
  }

  return `${EVENT_ALERTS_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function toCalendarDateString(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDateLabel(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function formatTimeLabel(value: string) {
  return TIME_FORMATTER.format(new Date(value));
}

function formatEventDateRange(start: string, end?: string) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startLabel = DATE_FORMATTER.format(startDate);

  if (!endDate || Number.isNaN(endDate.getTime())) {
    return startLabel;
  }

  const endLabel = DATE_FORMATTER.format(endDate);
  return startLabel === endLabel ? startLabel : `${startLabel} -> ${endLabel}`;
}

function formatEventTimeRange(start: string, end: string) {
  const startTime = formatTimeLabel(start);
  const endTime = formatTimeLabel(end);
  const isAllDay = startTime === '12:00 AM' && endTime === '11:59 PM';
  return isAllDay ? '' : `${startTime}-${endTime}`;
}

function isAllDayEvent(event: AppEvent) {
  return event.phases.length === 1 && event.phases[0].label.toLowerCase() === 'all day';
}

function formatPrimaryTimeLabel(event: AppEvent) {
  if (isAllDayEvent(event)) {
    return 'All day';
  }

  if (!event.end) {
    return formatTimeLabel(event.start);
  }

  const startLabel = SHORT_DATE_FORMATTER.format(new Date(event.start));
  const endLabel = SHORT_DATE_FORMATTER.format(new Date(event.end));
  if (startLabel === endLabel) {
    return formatEventTimeRange(event.start, event.end) || 'All day';
  }

  return `${formatTimeLabel(event.start)} -> ${formatTimeLabel(event.end)}`;
}

function buildGoogleCalendarUrl(event: AppEvent, projectName: string) {
  const end = event.end ?? event.start;
  const phaseLines = event.phases
    .map((phase) => `${phase.label}: ${formatEventDateRange(phase.start, phase.end)}`)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${projectName} - ${event.title}`,
    dates: `${toCalendarDateString(event.start)}/${toCalendarDateString(end)}`,
    details: `${event.title}\n${phaseLines ? `\n${phaseLines}\n` : ''}\nDetails: ${event.detailsUrl ?? event.tweetUrl}`,
    ctz: EVENT_TIMEZONE
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function fillTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\{([A-Z0-9_]+)\}\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function buildTimelineSectionHtml(event: AppEvent) {
  const timedPhases = event.phases.filter((phase) => phase.label.toLowerCase() !== 'all day');
  if (!timedPhases.length) {
    return '';
  }

  const rows = timedPhases
    .map((phase) => {
      const timeLabel = formatEventTimeRange(phase.start, phase.end);
      return `
          <tr>
            <td style="padding:10px 14px;font-weight:700;color:#fff7df;border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(phase.label)}</td>
            <td style="padding:10px 14px;color:rgba(255,244,214,0.72);border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(timeLabel || formatEventDateRange(phase.start, phase.end))}</td>
          </tr>`;
    })
    .join('');

  return `
          <tr>
            <td style="padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#d2bb77;margin-bottom:10px;font-weight:700;">
                Schedule
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1511;border-radius:16px;border:1px solid rgba(255,216,77,0.12);font-size:13px;overflow:hidden;">
                ${rows}
              </table>
            </td>
          </tr>`;
}

function buildSecondaryCtaHtml(calendarUrl: string) {
  return `<td><a href="${escapeHtml(calendarUrl)}" style="display:inline-block;border:1px solid rgba(255,255,255,0.18);background:#1a1511;color:#fff7df;font-weight:700;font-size:14px;text-decoration:none;padding:13px 20px;border-radius:999px;">Add to Calendar</a></td>`;
}

function buildProjectLinkHtml(project: Project) {
  if (!project.links?.site) {
    return '';
  }

  return `<tr><td style="padding:16px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);"><a href="${escapeHtml(project.links.site)}" style="font-size:13px;color:#d9ccff;text-decoration:none;font-weight:700;">Visit ${escapeHtml(project.name)} &#8594;</a></td></tr>`;
}

function buildBroadcastName(eventId: string) {
  return `event-alert:${eventId}`;
}

function buildBroadcastSubject(event: AppEvent, project: Project) {
  return `NEW EVENT ON MEGAETH | ${project.name} | ${event.title}`;
}

function buildBroadcastPreviewText(event: AppEvent, project: Project) {
  return `${project.name} just announced ${event.title} on MegaETH.`;
}

function buildBroadcastText(event: AppEvent, project: Project) {
  const detailsUrl = event.detailsUrl ?? event.tweetUrl;
  const lines = [
    'NEW EVENT ON MEGAETH',
    '',
    `${project.name} - ${event.title}`,
    `${formatEventDateRange(event.start, event.end)}${isAllDayEvent(event) ? '' : ` | ${formatPrimaryTimeLabel(event)}`}`,
    '',
    `Details: ${detailsUrl}`
  ];

  const timedPhases = event.phases.filter((phase) => phase.label.toLowerCase() !== 'all day');
  if (timedPhases.length) {
    lines.push('', 'Schedule:');
    timedPhases.forEach((phase) => {
      lines.push(`- ${phase.label}: ${formatEventTimeRange(phase.start, phase.end) || formatEventDateRange(phase.start, phase.end)}`);
    });
  }

  if (project.links?.site) {
    lines.push('', `Project: ${project.links.site}`);
  }

  return lines.join('\n');
}

function renderBroadcastHtml(event: AppEvent, project: Project) {
  const detailsUrl = event.detailsUrl ?? event.tweetUrl;
  const variables: Record<string, string> = {
    ECOSYSTEM_MAP_URL: getAbsoluteUrl('/Twittercard.png'),
    MEGABUNNISH_SYMBOL_URL: getAbsoluteUrl('/logos/Megabunnish.webp'),
    ECOSYSTEM_BADGE_TEXT: 'MegaETH Ecosystem Map',
    HERO_SUMMARY: escapeHtml(`${project.name} just lit up on the MegaETH ecosystem map. Save the date, review the timing, and jump into the official announcement below.`),
    HERO_SOURCE_NOTE: 'Source: Megabunnish snapshot',
    PROJECT_NAME: escapeHtml(project.name),
    PROJECT_HANDLE: escapeHtml((project.links?.twitter?.split('/').filter(Boolean).pop() ?? project.name).replace(/^@/, '')),
    PROJECT_TWITTER_URL: escapeHtml(project.links?.twitter ?? detailsUrl),
    PROJECT_LOGO_URL: escapeHtml(getAbsoluteUrl(project.logo ?? '/logos/MegaETH.webp')),
    NEWS_LABEL: 'Event',
    NEWS_TITLE: escapeHtml(event.title),
    NEWS_BODY: escapeHtml(`Track the latest move from ${project.name} on MegaETH. The key timing and useful links are right below.`),
    FACT_1_LABEL: 'Date',
    FACT_1_VALUE: escapeHtml(formatEventDateRange(event.start, event.end)),
    FACT_2_LABEL: 'Time',
    FACT_2_VALUE: escapeHtml(formatPrimaryTimeLabel(event)),
    TIMELINE_SECTION_HTML: buildTimelineSectionHtml(event),
    PRIMARY_CTA_LABEL: 'View Details',
    PRIMARY_CTA_URL: escapeHtml(detailsUrl),
    SECONDARY_CTA_HTML: buildSecondaryCtaHtml(buildGoogleCalendarUrl(event, project.name)),
    PROJECT_LINK_HTML: buildProjectLinkHtml(project),
    FOOTER_NOTE: isAllDayEvent(event)
      ? 'This event is scheduled as an all-day window.'
      : 'Watch the schedule closely in case additional phases get announced.',
    UNSUBSCRIBE_URL: '{{{RESEND_UNSUBSCRIBE_URL}}}'
  };

  return fillTemplate(TEMPLATE_HTML, variables);
}

function isUpcomingEvent(event: AppEvent) {
  const endValue = event.end ?? event.start;
  return new Date(endValue).getTime() > Date.now();
}

async function listAllBroadcasts(resend: Resend) {
  const items: { id: string; name: string | null }[] = [];
  let after: string | undefined;

  while (true) {
    const response = await resend.broadcasts.list(after ? { after, limit: 100 } : { limit: 100 });
    if (response.error) {
      throw new Error(readResendErrorMessage(response.error));
    }

    const page = response.data?.data ?? [];
    items.push(...page.map((broadcast) => ({ id: broadcast.id, name: broadcast.name })));

    if (!response.data?.has_more || page.length === 0) {
      break;
    }

    after = page[page.length - 1]?.id;
  }

  return items;
}

async function segmentHasSubscribers(resend: Resend, segmentId: string) {
  const response = await resend.contacts.list({ segmentId, limit: 1 });
  if (response.error) {
    throw new Error(readResendErrorMessage(response.error));
  }

  return (response.data?.data.length ?? 0) > 0 || Boolean(response.data?.has_more);
}

export async function subscribeToEventAlerts(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEventAlertEmail(normalizedEmail)) {
    throw new EventAlertsConfigError('Please enter a valid email address.');
  }

  const resend = getResendClient();
  const segment = await getOrCreateEventAlertsSegment(resend);
  const existingContactId = await getExistingContactId(resend, normalizedEmail);

  if (!existingContactId) {
    const createResponse = await resend.contacts.create({
      email: normalizedEmail,
      unsubscribed: false,
      segments: [{ id: segment.id }],
      properties: {
        event_alerts_status: 'subscribed',
        event_alerts_source: 'events_panel'
      }
    });

    if (createResponse.error) {
      throw new Error(readResendErrorMessage(createResponse.error));
    }
  } else {
    const updateResponse = await resend.contacts.update({
      email: normalizedEmail,
      unsubscribed: false,
      properties: {
        event_alerts_status: 'subscribed',
        event_alerts_source: 'events_panel'
      }
    });

    if (updateResponse.error && !isNotFoundError(updateResponse.error)) {
      throw new Error(readResendErrorMessage(updateResponse.error));
    }

    const addResponse = await resend.contacts.segments.add({ email: normalizedEmail, segmentId: segment.id });
    if (addResponse.error && !isConflictError(addResponse.error)) {
      throw new Error(readResendErrorMessage(addResponse.error));
    }
  }

  return {
    email: normalizedEmail,
    segmentId: segment.id,
    segmentName: segment.name
  };
}

export async function unsubscribeFromEventAlerts(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEventAlertEmail(normalizedEmail)) {
    throw new EventAlertsConfigError('Please enter a valid email address.');
  }

  const resend = getResendClient();
  const segment = await getOrCreateEventAlertsSegment(resend);
  const removeResponse = await resend.contacts.segments.remove({ email: normalizedEmail, segmentId: segment.id });

  if (removeResponse.error && !isNotFoundError(removeResponse.error)) {
    throw new Error(readResendErrorMessage(removeResponse.error));
  }

  return {
    email: normalizedEmail,
    segmentId: segment.id,
    segmentName: segment.name
  };
}

export async function sendNewEventAlerts(options: DispatchOptions = {}) {
  const resend = getResendClient();
  const segment = await getOrCreateEventAlertsSegment(resend);
  const hasSubscribers = await segmentHasSubscribers(resend, segment.id);

  if (!hasSubscribers) {
    return {
      dryRun: Boolean(options.dryRun),
      segmentId: segment.id,
      pendingEvents: [],
      sentEvents: [] as Array<{ eventId: string; broadcastId: string | null }>,
      skippedReason: 'No subscribers in event alerts segment.'
    };
  }

  const broadcasts = await listAllBroadcasts(resend);
  const existingBroadcastNames = new Set(broadcasts.map((broadcast) => broadcast.name).filter(Boolean));

  const pendingEvents = APP_EVENTS
    .filter(isUpcomingEvent)
    .filter((event) => !existingBroadcastNames.has(buildBroadcastName(event.id)));

  const sentEvents: Array<{ eventId: string; broadcastId: string | null }> = [];

  for (const event of pendingEvents) {
    const project = projectById.get(event.projectId);
    if (!project) {
      continue;
    }

    if (options.dryRun) {
      sentEvents.push({ eventId: event.id, broadcastId: null });
      continue;
    }

    const response = await resend.broadcasts.create({
      segmentId: segment.id,
      from: DEFAULT_FROM_ADDRESS,
      subject: buildBroadcastSubject(event, project),
      previewText: buildBroadcastPreviewText(event, project),
      html: renderBroadcastHtml(event, project),
      text: buildBroadcastText(event, project),
      name: buildBroadcastName(event.id),
      send: true
    });

    if (response.error) {
      throw new Error(readResendErrorMessage(response.error));
    }

    sentEvents.push({
      eventId: event.id,
      broadcastId: response.data?.id ?? null
    });
  }

  return {
    dryRun: Boolean(options.dryRun),
    segmentId: segment.id,
    pendingEvents: pendingEvents.map((event) => event.id),
    sentEvents
  };
}