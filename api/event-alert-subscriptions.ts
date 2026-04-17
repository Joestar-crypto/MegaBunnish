import {
  EventAlertsConfigError,
  getEventAlertUnsubscribePage,
  getEventAlertsStatus,
  isValidEventAlertEmail,
  subscribeToEventAlerts,
  unsubscribeFromEventAlerts,
  verifyEventAlertUnsubscribeToken
} from '../server/event-alerts/service';

type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
  send?(payload: unknown): void;
  end?(payload?: unknown): void;
};

function parseBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }

  return {};
}

function readEmail(body: unknown) {
  const payload = parseBody(body);
  return typeof payload.email === 'string' ? payload.email : '';
}

function readQueryValue(query: ApiRequest['query'], key: string) {
  const value = query?.[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function readHeader(headers: ApiRequest['headers'], key: string) {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isAdminAuthorized(request: ApiRequest) {
  const secret = process.env.EVENT_ALERTS_ADMIN_SECRET ?? process.env.EVENT_ALERTS_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = readHeader(request.headers, 'authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const querySecret = readQueryValue(request.query, 'secret');
  return bearerToken === secret || querySecret === secret;
}

function sendJson(response: ApiResponse, statusCode: number, payload: unknown) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(statusCode).json(payload);
}

function sendHtml(response: ApiResponse, statusCode: number, html: string) {
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

  response.json({ html });
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'GET,POST,DELETE');

  try {
    if (request.method === 'GET') {
      const email = readQueryValue(request.query, 'email');
      const token = readQueryValue(request.query, 'token');
      const action = readQueryValue(request.query, 'action');

      if (email && token) {
        if (!isValidEventAlertEmail(email)) {
          sendJson(response, 400, { error: 'Please enter a valid email address.' });
          return;
        }

        if (!verifyEventAlertUnsubscribeToken(email, token)) {
          sendJson(response, 401, { error: 'Invalid unsubscribe link.' });
          return;
        }

        if (action === 'unsubscribe') {
          await unsubscribeFromEventAlerts(email);
          sendHtml(response, 200, getEventAlertUnsubscribePage(email, true));
          return;
        }

        sendHtml(response, 200, getEventAlertUnsubscribePage(email, false));
        return;
      }

      if (!isAdminAuthorized(request)) {
        sendJson(response, 401, { error: 'Unauthorized.' });
        return;
      }

      const status = await getEventAlertsStatus();
      sendJson(response, 200, { ok: true, ...status });
      return;
    }

    const email = readEmail(request.body) || readQueryValue(request.query, 'email');

    if (!isValidEventAlertEmail(email)) {
      sendJson(response, 400, { error: 'Please enter a valid email address.' });
      return;
    }

    if (request.method === 'POST') {
      const result = await subscribeToEventAlerts(email);
      sendJson(response, 200, {
        ok: true,
        email: result.email,
        activeSubscriberCount: result.activeSubscriberCount,
        storageDriver: result.storageDriver
      });
      return;
    }

    if (request.method === 'DELETE') {
      const result = await unsubscribeFromEventAlerts(email);
      sendJson(response, 200, {
        ok: true,
        email: result.email,
        activeSubscriberCount: result.activeSubscriberCount,
        storageDriver: result.storageDriver
      });
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof EventAlertsConfigError || error instanceof Error
      ? error.message
      : 'Unable to update event alerts right now.';

    sendJson(response, 500, { error: message });
  }
}