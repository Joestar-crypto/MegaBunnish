import {
  AiAdvisorConfigError,
  generateAiAdvisorReply,
  type AdvisorChatMessage
} from '../server/ai-advisor';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
};

type RequestPayload = {
  message?: unknown;
  history?: unknown;
  conversationId?: unknown;
};

function parseBody(body: unknown): RequestPayload {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as RequestPayload;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as RequestPayload;
  }

  return {};
}

function sanitizeHistory(value: unknown): AdvisorChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const role = 'role' in entry ? entry.role : undefined;
      const content = 'content' in entry ? entry.content : undefined;
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return null;
      }

      return { role, content } as AdvisorChatMessage;
    })
    .filter((entry): entry is AdvisorChatMessage => Boolean(entry));
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Allow', 'POST');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = parseBody(request.body);
    const message = typeof payload.message === 'string' ? payload.message : '';
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
    const result = await generateAiAdvisorReply({
      message,
      history: sanitizeHistory(payload.history),
      conversationId
    });

    response.status(200).json({ ok: true, ...result });
  } catch (error) {
    const statusCode = error instanceof AiAdvisorConfigError ? 503 : 500;
    response.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Unable to answer right now.'
    });
  }
}