import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import rawProjects from '../../src/data/projects.json';
import { APP_EVENTS, type AppEvent } from '../../src/data/appEvents';
import { Resend } from 'resend';
import {
  buildEventAlertBroadcastName,
  ensureEventAlertStorage,
  ensureResendEventAlertTarget,
  getDeliveredEmailsForEvent,
  getEventAlertsSnapshot,
  recordEventAlertDelivery,
  subscribeEventAlertSubscriber,
  unsubscribeEventAlertSubscriber
} from './store';

const DEFAULT_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'Megabunnish <onboarding@resend.dev>';
const EVENT_ALERTS_BASE_URL = (process.env.EVENT_ALERTS_BASE_URL ?? process.env.EVENTS_BASE_URL ?? '').replace(/\/$/, '');
const EVENT_ALERTS_API_BASE_URL = (process.env.EVENT_ALERTS_API_BASE_URL ?? EVENT_ALERTS_BASE_URL).replace(/\/$/, '');
const TEMPLATE_PATH = fileURLToPath(new URL('../../emails/resend-news-template.html', import.meta.url));
const TEMPLATE_HTML = readFileSync(TEMPLATE_PATH, 'utf8');
const EVENT_TIMEZONE = 'America/New_York';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const SEND_BATCH_SIZE = 10;

type Project = {
  id: string;
  name: string;
  logo?: string;
  links?: {
    site?: string;
    twitter?: string;
  };
};

type ResendErrorLike = {
  message?: string;
  statusCode?: number;
  name?: string;
};

type DispatchOptions = {
  dryRun?: boolean;
};

type FailedDelivery = {
  eventId: string;
  email: string;
  error: string;
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
  const resendError = error as ResendErrorLike | undefined;
  return resendError?.message ?? 'Unexpected Resend error.';
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

function getEventAlertApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  if (!EVENT_ALERTS_API_BASE_URL) {
    throw new EventAlertsConfigError('Missing EVENT_ALERTS_API_BASE_URL, EVENT_ALERTS_BASE_URL, or EVENTS_BASE_URL for event alert API links.');
  }

  return `${EVENT_ALERTS_API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function toCalendarDateString(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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

function buildBroadcastSubject(event: AppEvent, project: Project) {
  return `NEW EVENT ON MEGAETH | ${project.name} | ${event.title}`;
}

function buildBroadcastPreviewText(event: AppEvent, project: Project) {
  return `${project.name} just announced ${event.title} on MegaETH.`;
}

function getUnsubscribeSecret() {
  const secret = process.env.EVENT_ALERTS_UNSUBSCRIBE_SECRET ?? process.env.EVENT_ALERTS_CRON_SECRET ?? process.env.RESEND_API_KEY;
  if (!secret) {
    throw new EventAlertsConfigError('Missing EVENT_ALERTS_UNSUBSCRIBE_SECRET, EVENT_ALERTS_CRON_SECRET, or RESEND_API_KEY for unsubscribe links.');
  }

  return secret;
}

function buildUnsubscribeToken(email: string) {
  return createHmac('sha256', getUnsubscribeSecret())
    .update(normalizeEmail(email))
    .digest('hex');
}

function buildEventAlertUnsubscribeUrl(email: string) {
  const params = new URLSearchParams({
    email: normalizeEmail(email),
    token: buildUnsubscribeToken(email),
    action: 'unsubscribe'
  });

  return `${getEventAlertApiUrl('/api/event-alert-subscriptions')}?${params.toString()}`;
}

function buildEventAlertUnsubscribeConfirmationUrl(email: string) {
  const params = new URLSearchParams({
    email: normalizeEmail(email),
    token: buildUnsubscribeToken(email),
    action: 'confirm'
  });

  return `${getEventAlertApiUrl('/api/event-alert-subscriptions')}?${params.toString()}`;
}

export function verifyEventAlertUnsubscribeToken(email: string, token: string) {
  const normalizedEmail = normalizeEmail(email);
  const expected = buildUnsubscribeToken(normalizedEmail);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(token, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function buildBroadcastText(event: AppEvent, project: Project, recipientEmail: string | null) {
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

  if (recipientEmail) {
    lines.push('', `Unsubscribe: ${buildEventAlertUnsubscribeConfirmationUrl(recipientEmail)}`);
  } else {
    lines.push('', `Manage alerts: ${getAbsoluteUrl('/')}`);
  }

  return lines.join('\n');
}

function renderBroadcastHtml(event: AppEvent, project: Project, recipientEmail: string | null) {
  const detailsUrl = event.detailsUrl ?? event.tweetUrl;
  const actionUrl = recipientEmail ? buildEventAlertUnsubscribeConfirmationUrl(recipientEmail) : getAbsoluteUrl('/');
  const footerNote = recipientEmail
    ? isAllDayEvent(event)
      ? 'This event is scheduled as an all-day window.'
      : 'Watch the schedule closely in case additional phases get announced.'
    : 'Manage your event alerts from the Megabunnish Events panel.';
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
    FOOTER_NOTE: footerNote,
    FOOTER_ACTION_LABEL: recipientEmail ? 'Unsubscribe' : 'Manage alerts',
    UNSUBSCRIBE_URL: escapeHtml(actionUrl)
  };

  return fillTemplate(TEMPLATE_HTML, variables);
}

function isUpcomingEvent(event: AppEvent) {
  const endValue = event.end ?? event.start;
  return new Date(endValue).getTime() > Date.now();
}

function chunkValues<T>(values: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

export async function subscribeToEventAlerts(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEventAlertEmail(normalizedEmail)) {
    throw new EventAlertsConfigError('Please enter a valid email address.');
  }

  return subscribeEventAlertSubscriber(normalizedEmail, 'events_panel');
}

export async function unsubscribeFromEventAlerts(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEventAlertEmail(normalizedEmail)) {
    throw new EventAlertsConfigError('Please enter a valid email address.');
  }

  return unsubscribeEventAlertSubscriber(normalizedEmail);
}

export async function getEventAlertsStatus() {
  const snapshot = await getEventAlertsSnapshot();

  return {
    storageDriver: snapshot.storageDriver,
    activeSubscriberCount: snapshot.activeSubscribers.length,
    subscribers: snapshot.subscribers,
    deliveries: snapshot.deliveries
  };
}

function createConfirmationHtml(email: string) {
  const unsubscribeUrl = buildEventAlertUnsubscribeUrl(email);
  const escapedEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manage event alerts</title>
  </head>
  <body style="margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <div style="background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;">
        <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Megabunnish Event Alerts</div>
        <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.1;">Unsubscribe ${escapedEmail}?</h1>
        <p style="margin:0 0 20px;color:rgba(255,244,214,0.78);line-height:1.6;">If you confirm, this email address will stop receiving new MegaETH ecosystem event announcements.</p>
        <a href="${escapeHtml(unsubscribeUrl)}" style="display:inline-block;background:#f5c84c;color:#1b1206;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px;">Confirm unsubscribe</a>
      </div>
    </div>
  </body>
</html>`;
}

function createUnsubscribedHtml(email: string) {
  const escapedEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribed</title>
  </head>
  <body style="margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <div style="background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;">
        <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Megabunnish Event Alerts</div>
        <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.1;">${escapedEmail} has been unsubscribed.</h1>
        <p style="margin:0;color:rgba(255,244,214,0.78);line-height:1.6;">You will no longer receive new event announcements unless you subscribe again from the Events panel.</p>
      </div>
    </div>
  </body>
</html>`;
}

export function getEventAlertUnsubscribePage(email: string, shouldFinalize: boolean) {
  return shouldFinalize ? createUnsubscribedHtml(email) : createConfirmationHtml(email);
}

export async function sendNewEventAlerts(options: DispatchOptions = {}) {
  await ensureEventAlertStorage();
  const snapshot = await getEventAlertsSnapshot();
  const activeSubscribers = snapshot.activeSubscriberEmails;

  if (!activeSubscribers.length) {
    return {
      dryRun: Boolean(options.dryRun),
      storageDriver: snapshot.storageDriver,
      subscriberCount: 0,
      pendingEvents: [],
      sentEvents: [] as Array<{ eventId: string; attemptedCount: number; sentCount: number; failedCount: number }>,
      failures: [] as FailedDelivery[],
      skippedReason: 'No subscribers in event alerts storage.'
    };
  }

  const pendingEvents = APP_EVENTS
    .filter(isUpcomingEvent)
    .map((event) => {
      const deliveredEmails = new Set(getDeliveredEmailsForEvent(snapshot.deliveries, event.id));
      const recipientEmails = activeSubscribers.filter((email) => !deliveredEmails.has(email));
      return {
        event,
        recipientEmails
      };
    })
    .filter((entry) => entry.recipientEmails.length > 0);

  const sentEvents: Array<{ eventId: string; attemptedCount: number; sentCount: number; failedCount: number }> = [];
  const failures: FailedDelivery[] = [];
  const resend = options.dryRun ? null : getResendClient();

  if (snapshot.storageDriver === 'resend-segment') {
    const target = options.dryRun ? null : await ensureResendEventAlertTarget();

    for (const pendingEvent of pendingEvents) {
      const { event, recipientEmails } = pendingEvent;
      const project = projectById.get(event.projectId);
      if (!project) {
        continue;
      }

      if (options.dryRun) {
        sentEvents.push({
          eventId: event.id,
          attemptedCount: recipientEmails.length,
          sentCount: 0,
          failedCount: 0
        });
        continue;
      }

      const response = await resend!.broadcasts.create({
        name: buildEventAlertBroadcastName(event.id),
        segmentId: target!.segmentId,
        topicId: target!.topicId,
        from: DEFAULT_FROM_ADDRESS,
        subject: buildBroadcastSubject(event, project),
        previewText: buildBroadcastPreviewText(event, project),
        html: renderBroadcastHtml(event, project, null),
        text: buildBroadcastText(event, project, null),
        send: true
      });

      if (response.error) {
        throw new Error(readResendErrorMessage(response.error));
      }

      sentEvents.push({
        eventId: event.id,
        attemptedCount: recipientEmails.length,
        sentCount: recipientEmails.length,
        failedCount: 0
      });
    }

    return {
      dryRun: Boolean(options.dryRun),
      storageDriver: snapshot.storageDriver,
      subscriberCount: activeSubscribers.length,
      pendingEvents: pendingEvents.map((entry) => ({
        eventId: entry.event.id,
        recipientCount: entry.recipientEmails.length
      })),
      sentEvents,
      failures
    };
  }

  for (const pendingEvent of pendingEvents) {
    const { event, recipientEmails } = pendingEvent;
    const project = projectById.get(event.projectId);
    if (!project) {
      continue;
    }

    if (options.dryRun) {
      sentEvents.push({
        eventId: event.id,
        attemptedCount: recipientEmails.length,
        sentCount: 0,
        failedCount: 0
      });
      continue;
    }

    const subject = buildBroadcastSubject(event, project);
    const deliveredEmails: string[] = [];
    const resendEmailIds: string[] = [];
    const failedEmails: Array<{ email: string; error: string }> = [];

    for (const recipientBatch of chunkValues(recipientEmails, SEND_BATCH_SIZE)) {
      const batchResults = await Promise.all(recipientBatch.map(async (recipientEmail) => {
        const response = await resend!.emails.send({
          from: DEFAULT_FROM_ADDRESS,
          to: [recipientEmail],
          subject,
          html: renderBroadcastHtml(event, project, recipientEmail),
          text: buildBroadcastText(event, project, recipientEmail),
          headers: {
            'List-Unsubscribe': `<${buildEventAlertUnsubscribeConfirmationUrl(recipientEmail)}>`,
            'X-Megabunnish-Event-Id': event.id
          }
        });

        if (response.error) {
          return {
            ok: false as const,
            email: recipientEmail,
            error: readResendErrorMessage(response.error)
          };
        }

        return {
          ok: true as const,
          email: recipientEmail,
          emailId: response.data?.id ?? null
        };
      }));

      batchResults.forEach((result) => {
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
    }

    await recordEventAlertDelivery({
      eventId: event.id,
      subject,
      deliveredEmails,
      resendEmailIds,
      failedEmails: failedEmails.map((entry) => entry.email),
      attemptedCount: recipientEmails.length
    });

    failures.push(...failedEmails.map((entry) => ({
      eventId: event.id,
      email: entry.email,
      error: entry.error
    })));

    if (!deliveredEmails.length && failedEmails.length) {
      throw new Error(`Unable to send event alert for ${event.id}: ${failedEmails[0].error}`);
    }

    sentEvents.push({
      eventId: event.id,
      attemptedCount: recipientEmails.length,
      sentCount: deliveredEmails.length,
      failedCount: failedEmails.length
    });
  }

  return {
    dryRun: Boolean(options.dryRun),
    storageDriver: snapshot.storageDriver,
    subscriberCount: activeSubscribers.length,
    pendingEvents: pendingEvents.map((entry) => ({
      eventId: entry.event.id,
      recipientCount: entry.recipientEmails.length
    })),
    sentEvents,
    failures
  };
}