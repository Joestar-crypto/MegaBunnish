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
  honeypot?: unknown;
};

type BudgetStatus = {
  enabled: boolean;
  key: string;
  count: number;
  softLimit: number;
  hardLimit: number;
  warning: boolean;
  blocked: boolean;
  resetsAtUtc: string;
};

const DAILY_SOFT_LIMIT = 500;
const DAILY_HARD_LIMIT = 1000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 400;
const MIN_MESSAGE_LENGTH = 3;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

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
    .filter((entry): entry is AdvisorChatMessage => Boolean(entry))
    .slice(-MAX_HISTORY_MESSAGES);
}

function getBudgetKey(date = new Date()) {
  return `megabunnish:ai-budget:${date.toISOString().slice(0, 10)}`;
}

function getNextUtcMidnight(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));
}

async function runUpstashCommand(command: unknown[]) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return null;
  }

  const response = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Budget store request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { result?: unknown };
  return payload.result ?? null;
}

function buildBudgetStatus(count: number, now = new Date()): BudgetStatus {
  return {
    enabled: Boolean(UPSTASH_URL && UPSTASH_TOKEN),
    key: getBudgetKey(now),
    count,
    softLimit: DAILY_SOFT_LIMIT,
    hardLimit: DAILY_HARD_LIMIT,
    warning: count >= DAILY_SOFT_LIMIT,
    blocked: count >= DAILY_HARD_LIMIT,
    resetsAtUtc: getNextUtcMidnight(now).toISOString()
  };
}

async function readBudgetStatus(): Promise<BudgetStatus> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return buildBudgetStatus(0);
  }

  const raw = await runUpstashCommand(['GET', getBudgetKey()]);
  const count = typeof raw === 'number' ? raw : Number(raw ?? 0) || 0;
  return buildBudgetStatus(count);
}

async function incrementBudgetCounter(): Promise<BudgetStatus> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return buildBudgetStatus(0);
  }

  const now = new Date();
  const key = getBudgetKey(now);
  const nextMidnight = getNextUtcMidnight(now);
  const raw = await runUpstashCommand(['INCR', key]);
  const count = typeof raw === 'number' ? raw : Number(raw ?? 0) || 0;

  // Reset the daily budget automatically at midnight UTC.
  await runUpstashCommand(['EXPIREAT', key, Math.floor(nextMidnight.getTime() / 1000)]);

  return buildBudgetStatus(count, now);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Allow', 'GET, POST');

  if (request.method === 'GET') {
    try {
      const budget = await readBudgetStatus();
      response.status(200).json({ ok: true, budget });
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : 'Unable to read budget status right now.'
      });
    }
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = parseBody(request.body);

    // Hidden honeypot field catches basic scripted form submissions.
    if (typeof payload.honeypot === 'string' && payload.honeypot.trim()) {
      response.status(400).json({ error: 'That send looked automated, so I ignored it.' });
      return;
    }

    const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
    if (message.length < MIN_MESSAGE_LENGTH) {
      response.status(400).json({ error: 'Give me a little more to work with.' });
      return;
    }

    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
    const budget = await incrementBudgetCounter();

    if (budget.blocked) {
      response.status(429).json({
        error: 'Daily limit reached, back tomorrow.',
        budget
      });
      return;
    }

    const result = await generateAiAdvisorReply({
      message,
      history: sanitizeHistory(payload.history),
      conversationId
    });

    response.status(200).json({ ok: true, ...result, budget });
  } catch (error) {
    const statusCode = error instanceof AiAdvisorConfigError ? 503 : 500;
    response.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Unable to answer right now.'
    });
  }
}