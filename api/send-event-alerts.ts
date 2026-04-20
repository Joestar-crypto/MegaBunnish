import { sendNewEventAlerts } from '../server/event-alerts/service';

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
};

function readHeader(headers: ApiRequest['headers'], key: string) {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readQueryValues(query: ApiRequest['query'], key: string) {
  const value = query?.[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readQueryBoolean(query: ApiRequest['query'], key: string) {
  const value = query?.[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === 'true';
}

function isAuthorized(request: ApiRequest) {
  const secret = process.env.EVENT_ALERTS_CRON_SECRET;
  if (!secret) {
    return true;
  }

  const authorization = readHeader(request.headers, 'authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const querySecret = request.query?.secret;
  const normalizedQuerySecret = Array.isArray(querySecret) ? querySecret[0] : querySecret;

  return bearerToken === secret || normalizedQuerySecret === secret;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Allow', 'GET,POST');

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!isAuthorized(request)) {
    response.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const result = await sendNewEventAlerts({
      dryRun: readQueryBoolean(request.query, 'dry_run'),
      eventIds: readQueryValues(request.query, 'eventId'),
      force: readQueryBoolean(request.query, 'force')
    });
    response.status(200).json({ ok: true, ...result });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to send event alerts.'
    });
  }
}