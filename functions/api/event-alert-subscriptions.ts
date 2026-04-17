import {
  escapeHtml,
  getAlertApiBaseUrl,
  getEventAlertsSnapshot,
  htmlResponse,
  isAdminAuthorized,
  isValidEventAlertEmail,
  jsonResponse,
  parseJsonBody,
  subscribeEventAlertSubscriber,
  unsubscribeEventAlertSubscriber,
  verifyEventAlertUnsubscribeToken,
  type EventAlertsEnv
} from '../_shared/event-alerts';

type FunctionContext = {
  request: Request;
  env: EventAlertsEnv;
};

function createConfirmationHtml(email: string, unsubscribeUrl: string) {
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
        <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.1;">Unsubscribed</h1>
        <p style="margin:0;color:rgba(255,244,214,0.78);line-height:1.6;">${escapedEmail} will no longer receive new MegaETH ecosystem event announcements.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function handleGet(context: FunctionContext) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const action = url.searchParams.get('action') ?? '';

  if (email && token) {
    if (!isValidEventAlertEmail(email)) {
      return jsonResponse({ error: 'Please enter a valid email address.' }, 400, { Allow: 'GET,POST,DELETE,OPTIONS' });
    }

    const isValidToken = await verifyEventAlertUnsubscribeToken(env, email, token);
    if (!isValidToken) {
      return jsonResponse({ error: 'Invalid unsubscribe link.' }, 401, { Allow: 'GET,POST,DELETE,OPTIONS' });
    }

    if (action === 'unsubscribe') {
      await unsubscribeEventAlertSubscriber(env, email);
      return htmlResponse(createUnsubscribedHtml(email), 200, { Allow: 'GET,POST,DELETE,OPTIONS' });
    }

    const baseUrl = getAlertApiBaseUrl(request, env);
    const unsubscribeUrl = `${baseUrl}/api/event-alert-subscriptions?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&action=unsubscribe`;
    return htmlResponse(createConfirmationHtml(email, unsubscribeUrl), 200, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }

  if (!isAdminAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }

  const snapshot = await getEventAlertsSnapshot(env);

  return jsonResponse({
    ok: true,
    storageDriver: snapshot.storageDriver,
    storageKey: snapshot.storageKey,
    activeSubscriberCount: snapshot.activeSubscribers.length,
    subscribers: snapshot.subscribers,
    deliveries: snapshot.deliveries
  }, 200, { Allow: 'GET,POST,DELETE,OPTIONS' });
}

async function handleMutation(context: FunctionContext, method: 'POST' | 'DELETE') {
  const { request, env } = context;
  const url = new URL(request.url);
  const payload = await parseJsonBody(request);
  const emailFromBody = typeof payload.email === 'string' ? payload.email : '';
  const email = emailFromBody || url.searchParams.get('email') || '';

  if (!isValidEventAlertEmail(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }

  const result = method === 'POST'
    ? await subscribeEventAlertSubscriber(env, email)
    : await unsubscribeEventAlertSubscriber(env, email);

  return jsonResponse({ ok: true, ...result }, 200, { Allow: 'GET,POST,DELETE,OPTIONS' });
}

export async function onRequestGet(context: FunctionContext) {
  try {
    return await handleGet(context);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }
}

export async function onRequestPost(context: FunctionContext) {
  try {
    return await handleMutation(context, 'POST');
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }
}

export async function onRequestDelete(context: FunctionContext) {
  try {
    return await handleMutation(context, 'DELETE');
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unable to update event alerts right now.'
    }, 500, { Allow: 'GET,POST,DELETE,OPTIONS' });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Allow': 'GET,POST,DELETE,OPTIONS'
    }
  });
}