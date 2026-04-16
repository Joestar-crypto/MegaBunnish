import {
  EventAlertsConfigError,
  isValidEventAlertEmail,
  subscribeToEventAlerts,
  unsubscribeFromEventAlerts
} from '../server/event-alerts/service';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
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

function sendJson(response: ApiResponse, statusCode: number, payload: unknown) {
  response.status(statusCode).json(payload);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Allow', 'POST,DELETE');

  const email = readEmail(request.body);

  if (!isValidEventAlertEmail(email)) {
    sendJson(response, 400, { error: 'Please enter a valid email address.' });
    return;
  }

  try {
    if (request.method === 'POST') {
      const result = await subscribeToEventAlerts(email);
      sendJson(response, 200, { ok: true, email: result.email });
      return;
    }

    if (request.method === 'DELETE') {
      const result = await unsubscribeFromEventAlerts(email);
      sendJson(response, 200, { ok: true, email: result.email });
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