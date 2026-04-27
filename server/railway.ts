import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import aiChatHandler from '../api/ai-chat';
import aiAdvisorHandler from '../api/ai-advisor';
import subscriptionsHandler from '../api/event-alert-subscriptions';
import sendEventAlertsHandler from '../api/send-event-alerts';

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

type ApiHandler = (request: ApiRequest, response: ApiResponse) => Promise<void>;

const PORT = readPort(process.env.PORT);
const HOST = '0.0.0.0';
const ALLOW_METHODS = 'GET,POST,DELETE,OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization';

function readPort(value?: string) {
  const parsed = Number.parseInt(value ?? '3000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function buildQuery(url: URL) {
  const query: Record<string, string | string[]> = {};

  url.searchParams.forEach((value, key) => {
    const current = query[key];
    if (current === undefined) {
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

function getConfiguredOrigins() {
  return (process.env.EVENT_ALERTS_ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function resolveAllowedOrigin(request: IncomingMessage) {
  const configuredOrigins = getConfiguredOrigins();
  if (!configuredOrigins.length) {
    return '*';
  }

  const requestOrigin = typeof request.headers.origin === 'string'
    ? request.headers.origin.trim().replace(/\/$/, '')
    : '';

  if (!requestOrigin) {
    return configuredOrigins[0] ?? null;
  }

  return configuredOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const allowedOrigin = resolveAllowedOrigin(request);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  response.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
  response.setHeader('Access-Control-Max-Age', '86400');

  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      resolve(body);
    });
    request.on('error', reject);
  });
}

function createResponseAdapter(response: ServerResponse): ApiResponse {
  let statusCode = 200;

  const writePayload = (payload?: unknown) => {
    response.statusCode = statusCode;

    if (payload === undefined) {
      response.end();
      return;
    }

    if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
      response.end(payload);
      return;
    }

    response.end(String(payload));
  };

  const adapter: ApiResponse = {
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    status(code) {
      statusCode = code;
      return adapter;
    },
    json(payload) {
      if (!response.getHeader('Content-Type')) {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }

      response.statusCode = statusCode;
      response.end(JSON.stringify(payload));
    },
    send(payload) {
      if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        if (!response.getHeader('Content-Type')) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
        }

        response.statusCode = statusCode;
        response.end(JSON.stringify(payload));
        return;
      }

      writePayload(payload);
    },
    end(payload) {
      writePayload(payload);
    }
  };

  return adapter;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const pathname = normalizePathname(url.pathname);

  if (pathname === '/health' || pathname === '/healthz') {
    sendJson(response, 200, { ok: true, service: 'event-alerts-api' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  const handler: ApiHandler | null = pathname === '/api/event-alert-subscriptions'
    ? subscriptionsHandler
    : pathname === '/api/ai-chat'
      ? aiChatHandler
    : pathname === '/api/ai-advisor'
      ? aiAdvisorHandler
    : pathname === '/api/send-event-alerts'
      ? sendEventAlertsHandler
      : null;

  if (!handler) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  const body = request.method === 'POST' || request.method === 'DELETE'
    ? await readRequestBody(request)
    : undefined;

  const apiRequest: ApiRequest = {
    method: request.method,
    body,
    query: buildQuery(url),
    headers: request.headers as Record<string, string | string[] | undefined>
  };

  await handler(apiRequest, createResponseAdapter(response));
}

const server = createServer(async (request, response) => {
  applyCorsHeaders(request, response);

  try {
    await routeRequest(request, response);
  } catch (error) {
    if (response.headersSent) {
      response.end();
      return;
    }

    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Internal server error.'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Event alerts API listening on http://${HOST}:${PORT}`);
});