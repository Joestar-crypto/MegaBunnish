import rawProjects from '../../src/data/projects.json';
import { APP_EVENTS, type AppEvent } from '../../src/data/appEvents';
import {
  buildEventAlertApiUrl,
  buildUnsubscribeToken,
  createResendEventAlertBroadcast,
  ensureResendEventAlertTarget,
  escapeHtml,
  getDeliveredEmailsForEvent,
  getEventAlertsSnapshot,
  isAdminAuthorized,
  jsonResponse,
  parseJsonBody,
  recordEventAlertDelivery,
  type EventAlertsEnv
} from '../_shared/event-alerts';

type FunctionContext = {
  request: Request;
  env: EventAlertsEnv;
};

type Project = {
  id: string;
  name: string;
  logo?: string;
  links?: {
    site?: string;
    twitter?: string;
  };
};

type FailedDelivery = {
  eventId: string;
  email: string;
  error: string;
};

const DEFAULT_FROM_ADDRESS = 'Megabunnish <onboarding@resend.dev>';
const EVENT_TIMEZONE = 'America/New_York';
const SEND_BATCH_SIZE = 10;

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

function getResendApiKey(env: EventAlertsEnv) {
  if (!env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY on this deployment.');
  }

  return env.RESEND_API_KEY;
}

function getFromAddress(env: EventAlertsEnv) {
  return env.RESEND_FROM_ADDRESS ?? DEFAULT_FROM_ADDRESS;
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

function isUpcomingEvent(event: AppEvent) {
  const endValue = event.end ?? event.start;
  return new Date(endValue).getTime() > Date.now();
}

function buildBroadcastSubject(event: AppEvent, project: Project) {
  return `NEW EVENT ON MEGAETH | ${project.name} | ${event.title}`;
}

async function buildUnsubscribeUrl(request: Request, env: EventAlertsEnv, recipientEmail: string) {
  const token = await buildUnsubscribeToken(env, recipientEmail);
  const baseUrl = buildEventAlertApiUrl(request, env, '/api/event-alert-subscriptions');
  return `${baseUrl}?email=${encodeURIComponent(recipientEmail)}&token=${encodeURIComponent(token)}&action=confirm`;
}

function buildBroadcastText(event: AppEvent, project: Project, recipientEmail: string | null, actionUrl: string, actionLabel: string) {
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

  lines.push('', `${actionLabel}: ${actionUrl}`);
  if (recipientEmail) {
    lines.push(`Recipient: ${recipientEmail}`);
  }

  return lines.join('\n');
}

function buildPhasesHtml(event: AppEvent) {
  const phases = event.phases.filter((phase) => phase.label.toLowerCase() !== 'all day');
  if (!phases.length) {
    return '';
  }

  const items = phases
    .map((phase) => `<li style="margin:0 0 6px;"><strong>${escapeHtml(phase.label)}</strong>: ${escapeHtml(formatEventTimeRange(phase.start, phase.end) || formatEventDateRange(phase.start, phase.end))}</li>`)
    .join('');

  return `<div style="margin-top:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:1.3px;color:#d2bb77;font-weight:700;margin-bottom:8px;">Schedule</div><ul style="padding-left:18px;margin:0;color:#f7f1ef;">${items}</ul></div>`;
}

function renderBroadcastHtml(request: Request, env: EventAlertsEnv, event: AppEvent, project: Project, recipientEmail: string | null, actionUrl: string, actionLabel: string) {
  const detailsUrl = event.detailsUrl ?? event.tweetUrl;
  const projectLogoUrl = project.logo ? buildEventAlertApiUrl(request, env, project.logo) : buildEventAlertApiUrl(request, env, '/logos/MegaETH.webp');
  const projectSiteHtml = project.links?.site
    ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(project.links.site)}" style="color:#d2bb77;text-decoration:none;font-weight:700;">Visit ${escapeHtml(project.name)} - site</a></p>`
    : '';
  const footerText = recipientEmail
    ? `This email was sent to ${escapeHtml(recipientEmail)} because you subscribed to Megabunnish event alerts.`
    : 'You received this because you subscribed to Megabunnish event alerts. Manage your alerts from the Megabunnish site.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(event.title)}</title>
  </head>
  <body style="margin:0;background:#0d0a08;color:#fff7df;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
      <div style="background:#17110d;border:1px solid rgba(255,216,77,0.16);border-radius:24px;padding:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <img src="${escapeHtml(projectLogoUrl)}" alt="${escapeHtml(project.name)}" style="width:52px;height:52px;border-radius:16px;object-fit:cover;background:#0d0a08;" />
          <div>
            <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">MegaETH Event Alert</div>
            <div style="font-size:20px;font-weight:700;color:#fff7df;">${escapeHtml(project.name)}</div>
          </div>
        </div>
        <h1 style="margin:0 0 10px;font-size:30px;line-height:1.1;">${escapeHtml(event.title)}</h1>
        <p style="margin:0;color:rgba(255,244,214,0.78);line-height:1.6;">${escapeHtml(project.name)} just added a new event to the Megabunnish ecosystem map.</p>
        <div style="margin-top:18px;padding:16px 18px;border-radius:18px;background:#120e0b;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#d2bb77;font-weight:700;margin-bottom:6px;">Date</div>
          <div style="font-size:16px;font-weight:700;color:#fff7df;">${escapeHtml(formatEventDateRange(event.start, event.end))}</div>
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#d2bb77;font-weight:700;margin:14px 0 6px;">Time</div>
          <div style="font-size:16px;font-weight:700;color:#fff7df;">${escapeHtml(formatPrimaryTimeLabel(event))}</div>
          ${buildPhasesHtml(event)}
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
          <a href="${escapeHtml(detailsUrl)}" style="display:inline-block;background:#f5c84c;color:#1b1206;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;">View details</a>
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border:1px solid rgba(255,255,255,0.18);color:#fff7df;font-weight:700;text-decoration:none;padding:12px 18px;border-radius:999px;">${escapeHtml(actionLabel)}</a>
        </div>
        ${projectSiteHtml}
        <p style="margin:18px 0 0;font-size:12px;color:rgba(255,244,214,0.58);">${footerText}</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendResendEmail(env: EventAlertsEnv, recipientEmail: string, subject: string, html: string, text: string, unsubscribeUrl: string, eventId: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getResendApiKey(env)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: getFromAddress(env),
      to: [recipientEmail],
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'X-Megabunnish-Event-Id': eventId
      }
    })
  });

  const payload = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.name ?? `Resend API error (${response.status})`);
  }

  return payload?.id ?? null;
}

function chunkValues<T>(values: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

function normalizeRequestedEventIds(eventIds: string[] | undefined) {
  return Array.from(new Set((eventIds ?? []).map((eventId) => eventId.trim()).filter(Boolean)));
}

async function dispatchEventAlerts(context: FunctionContext, dryRun: boolean, requestedEventIds: string[]) {
  const { request, env } = context;
  const snapshot = await getEventAlertsSnapshot(env);
  const activeSubscribers = snapshot.activeSubscriberEmails;
  const requestedEventIdSet = new Set(requestedEventIds);

  if (!activeSubscribers.length) {
    return {
      ok: true,
      dryRun,
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
    .filter((event) => !requestedEventIdSet.size || requestedEventIdSet.has(event.id))
    .map((event) => {
      const deliveredEmails = new Set(getDeliveredEmailsForEvent(snapshot.deliveries, event.id));
      const recipientEmails = activeSubscribers.filter((email) => !deliveredEmails.has(email));
      return { event, recipientEmails };
    })
    .filter((entry) => entry.recipientEmails.length > 0);

  if (!pendingEvents.length) {
    return {
      ok: true,
      dryRun,
      storageDriver: snapshot.storageDriver,
      subscriberCount: activeSubscribers.length,
      pendingEvents: [] as Array<{ eventId: string; recipientCount: number }>,
      sentEvents: [] as Array<{ eventId: string; attemptedCount: number; sentCount: number; failedCount: number }>,
      failures: [] as FailedDelivery[],
      skippedReason: requestedEventIds.length
        ? `No pending event alerts matched the requested event ids: ${requestedEventIds.join(', ')}`
        : 'No pending event alerts to send.'
    };
  }

  const sentEvents: Array<{ eventId: string; attemptedCount: number; sentCount: number; failedCount: number }> = [];
  const failures: FailedDelivery[] = [];

  if (snapshot.storageDriver === 'resend-segment') {
    const target = dryRun ? null : await ensureResendEventAlertTarget(env);

    for (const pendingEvent of pendingEvents) {
      const { event, recipientEmails } = pendingEvent;
      const project = projectById.get(event.projectId);
      if (!project) {
        continue;
      }

      if (dryRun) {
        sentEvents.push({
          eventId: event.id,
          attemptedCount: recipientEmails.length,
          sentCount: 0,
          failedCount: 0
        });
        continue;
      }

      const actionUrl = buildEventAlertApiUrl(request, env, '/');
      await createResendEventAlertBroadcast(env, {
        eventId: event.id,
        segmentId: target!.segmentId,
        topicId: target!.topicId,
        from: getFromAddress(env),
        subject: buildBroadcastSubject(event, project),
        previewText: `${project.name} just announced ${event.title} on MegaETH.`,
        html: renderBroadcastHtml(request, env, event, project, null, actionUrl, 'Manage alerts'),
        text: buildBroadcastText(event, project, null, actionUrl, 'Manage alerts')
      });

      sentEvents.push({
        eventId: event.id,
        attemptedCount: recipientEmails.length,
        sentCount: recipientEmails.length,
        failedCount: 0
      });
    }

    return {
      ok: true,
      dryRun,
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

    if (dryRun) {
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
        try {
          const unsubscribeUrl = await buildUnsubscribeUrl(request, env, recipientEmail);
          const html = renderBroadcastHtml(request, env, event, project, recipientEmail, unsubscribeUrl, 'Manage subscription');
          const text = buildBroadcastText(event, project, recipientEmail, unsubscribeUrl, 'Unsubscribe');
          const emailId = await sendResendEmail(env, recipientEmail, subject, html, text, unsubscribeUrl, event.id);

          return {
            ok: true as const,
            email: recipientEmail,
            emailId
          };
        } catch (error) {
          return {
            ok: false as const,
            email: recipientEmail,
            error: error instanceof Error ? error.message : 'Unable to send alert.'
          };
        }
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

    await recordEventAlertDelivery(env, {
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

    sentEvents.push({
      eventId: event.id,
      attemptedCount: recipientEmails.length,
      sentCount: deliveredEmails.length,
      failedCount: failedEmails.length
    });
  }

  return {
    ok: true,
    dryRun,
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

async function handleRequest(context: FunctionContext) {
  const { request, env } = context;

  if (!isAdminAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401, { Allow: 'GET,POST,OPTIONS' });
  }

  const url = new URL(request.url);
  const body = request.method === 'POST' ? await parseJsonBody(request) : {};
  const dryRun = url.searchParams.get('dry_run') === 'true' || body.dryRun === true;
  const requestedEventIds = normalizeRequestedEventIds([
    ...url.searchParams.getAll('eventId'),
    ...(typeof body.eventId === 'string' ? [body.eventId] : []),
    ...(Array.isArray(body.eventIds) ? body.eventIds.filter((value): value is string => typeof value === 'string') : [])
  ]);

  const result = await dispatchEventAlerts(context, dryRun, requestedEventIds);
  return jsonResponse(result, 200, { Allow: 'GET,POST,OPTIONS' });
}

export async function onRequestGet(context: FunctionContext) {
  try {
    return await handleRequest(context);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to send event alerts.'
    }, 500, { Allow: 'GET,POST,OPTIONS' });
  }
}

export async function onRequestPost(context: FunctionContext) {
  try {
    return await handleRequest(context);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to send event alerts.'
    }, 500, { Allow: 'GET,POST,OPTIONS' });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'GET,POST,OPTIONS'
    }
  });
}