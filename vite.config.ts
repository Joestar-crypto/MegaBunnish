import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import aiChatHandler from './api/ai-chat';
import basicSsl from '@vitejs/plugin-basic-ssl';
import aiAdvisorHandler from './api/ai-advisor';
import eventAlertSubscriptionsHandler from './api/event-alert-subscriptions';
import sendEventAlertsHandler from './api/send-event-alerts';

type LocalApiHandler = (request: {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}, response: {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): unknown;
  json(payload: unknown): void;
  send?(payload: unknown): void;
  end?(payload?: unknown): void;
}) => Promise<void>;

function resolveLocalApiHandler(pathname: string): LocalApiHandler | null {
  if (pathname === '/api/ai-chat') {
    return aiChatHandler;
  }
  if (pathname === '/api/ai-advisor') {
    return aiAdvisorHandler;
  }
  if (pathname === '/api/event-alert-subscriptions') {
    return eventAlertSubscriptionsHandler;
  }
  if (pathname === '/api/send-event-alerts') {
    return sendEventAlertsHandler;
  }
  return null;
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });
}

function readQueryParams(url: URL) {
  const query: Record<string, string | string[] | undefined> = {};
  url.searchParams.forEach((value, key) => {
    const current = query[key];
    if (typeof current === 'undefined') {
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

function createResponseAdapter(response: ServerResponse) {
  return {
    setHeader(name: string, value: string | string[]) {
      response.setHeader(name, value);
    },
    status(code: number) {
      response.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      if (!response.headersSent) {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      response.end(JSON.stringify(payload));
    },
    send(payload: unknown) {
      response.end(typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
    },
    end(payload?: unknown) {
      response.end(payload as Parameters<ServerResponse['end']>[0]);
    }
  };
}

function attachLocalApiMiddleware(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (request, response, next) => {
    if (!request.url) {
      next();
      return;
    }

    const url = new URL(request.url, 'https://localhost');
    const handler = resolveLocalApiHandler(url.pathname);
    if (!handler) {
      next();
      return;
    }

    try {
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
        ? await readRequestBody(request)
        : undefined;

      await handler(
        {
          method: request.method,
          body,
          query: readQueryParams(url),
          headers: request.headers as Record<string, string | string[] | undefined>
        },
        createResponseAdapter(response)
      );

      if (!response.writableEnded) {
        response.end();
      }
    } catch (error) {
      next(error);
    }
  });
}

function localApiPlugin(): Plugin {
  return {
    name: 'local-event-alert-api',
    configureServer(server) {
      attachLocalApiMiddleware(server);
    },
    configurePreviewServer(server) {
      attachLocalApiMiddleware(server);
    }
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), localApiPlugin()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
  },
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/ethos-api': {
        target: 'https://api.ethos.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ethos-api/, '/api/v2'),
        secure: true,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
      },
    },
  }
});
