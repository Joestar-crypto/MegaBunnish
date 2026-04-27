import { randomUUID } from 'node:crypto';
import { APP_EVENTS, type AppEvent } from '../src/data/appEvents';
import rawProjects from '../src/data/projects.json';

type AdvisorProject = {
  id: string;
  name: string;
  categories: string[];
  networks: string[];
  links: {
    site?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
    docs?: string;
    nft?: string;
  };
  logo: string;
  isLive?: boolean;
  incentives?: Array<{
    id: string;
    title: string;
    reward: string;
    startsAt?: string;
    expiresAt: string;
  }>;
  linkedIds?: string[];
  jojoInsight?: string;
};

export type AdvisorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AdvisorRecommendation = {
  projectId: string;
  reason: string;
};

export type AdvisorReply = {
  answer: string;
  conversationId: string;
  recommendations: AdvisorRecommendation[];
  sourceProjectIds: string[];
  sourceEventIds: string[];
  suggestedPrompts: string[];
};

type IntentProfile = {
  categories: string[];
  strictLending: boolean;
  strictBridge: boolean;
  strictTrading: boolean;
  strictMobile: boolean;
  strictAi: boolean;
  preferLive: boolean;
  preferIncentives: boolean;
  keywords: string[];
};

type RankedProject = {
  project: AdvisorProject;
  score: number;
  reason: string;
};

type ProviderConfig = {
  apiKey?: string;
  model: string;
  baseUrl: string;
  provider: 'openai-compatible' | 'anthropic';
};

const PROJECTS = rawProjects as AdvisorProject[];
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_SUGGESTED_PROMPTS = [
  'Which lending protocol looks strongest on MegaETH right now?',
  'Compare the safest DeFi options for a new user.',
  'Which bridge should I use to move into MegaETH?',
  'Which mobile-first app should I try first?'
];

export class AiAdvisorConfigError extends Error {}

function isLocalBaseUrl(baseUrl: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl);
}

function isAnthropicBaseUrl(baseUrl: string) {
  return /anthropic\.com/i.test(baseUrl);
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

const buildCorpus = (project: AdvisorProject) =>
  normalize(
    [
      project.name,
      project.id,
      ...project.categories,
      ...project.networks,
      project.jojoInsight ?? '',
      ...(project.incentives ?? []).flatMap((entry) => [entry.title, entry.reward])
    ].join(' ')
  );

function detectIntent(query: string): IntentProfile {
  const normalized = normalize(query);
  const categories = new Set<string>();

  if (/(lend|lending|borrow|loan|yield|farm|stable|money market|credit)/.test(normalized)) {
    categories.add('DeFi');
  }
  if (/(bridge|bridg|transfer|onramp|offramp)/.test(normalized)) {
    categories.add('Bridge');
  }
  if (/(trade|trading|perp|perps|options|dex|swap|market making)/.test(normalized)) {
    categories.add('Trading');
  }
  if (/(mobile|iphone|android|app store|play store)/.test(normalized)) {
    categories.add('Mobile');
  }
  if (/(ai|agent|agents|autonomous)/.test(normalized)) {
    categories.add('AI');
  }

  if (!categories.size) {
    categories.add('DeFi');
  }

  return {
    categories: [...categories],
    strictLending: /(lend|lending|borrow|loan|credit)/.test(normalized),
    strictBridge: /(bridge|bridg|transfer|onramp|offramp)/.test(normalized),
    strictTrading: /(trade|trading|perp|perps|options|dex|swap)/.test(normalized),
    strictMobile: /(mobile|iphone|android)/.test(normalized),
    strictAi: /(ai|agent|agents|autonomous)/.test(normalized),
    preferLive: /(live|now|active|today|current|right now)/.test(normalized),
    preferIncentives: /(farm|yield|points|reward|incentive)/.test(normalized),
    keywords: tokenize(query)
  };
}

function buildReason(project: AdvisorProject, corpus: string, intent: IntentProfile, event: AppEvent | null) {
  if (intent.strictLending && /lending|borrow|loan|credit/.test(corpus)) {
    return project.jojoInsight ?? 'Explicitly positioned around lending and borrowing in the current MegaBunnish data.';
  }
  if (intent.strictBridge && project.categories.includes('Bridge')) {
    return project.jojoInsight ?? 'Bridge-focused project in the MegaETH ecosystem dataset.';
  }
  if (intent.strictTrading && project.categories.includes('Trading')) {
    return project.jojoInsight ?? 'Trading-focused project with a clear product thesis in the dataset.';
  }
  if (intent.strictMobile && project.categories.includes('Mobile')) {
    return project.jojoInsight ?? 'Mobile-oriented product in the current MegaETH ecosystem list.';
  }
  if (intent.strictAi && project.categories.includes('AI')) {
    return project.jojoInsight ?? 'AI project with a differentiated angle in the current dataset.';
  }
  if (project.incentives?.length) {
    return `Visible incentive: ${project.incentives[0].title}.`;
  }
  if (event) {
    return `Relevant event: ${event.title}.`;
  }
  return project.jojoInsight ?? `${project.name} is a relevant ${project.categories[0] ?? 'ecosystem'} project in the current site data.`;
}

function findBestEvent(projectId: string, nowMs: number) {
  const entries = APP_EVENTS.filter((event) => event.projectId === projectId)
    .map((event) => {
      const startMs = new Date(event.start).getTime();
      const endMs = event.end ? new Date(event.end).getTime() : startMs;
      const isActive = startMs <= nowMs && endMs >= nowMs;
      const isUpcoming = startMs > nowMs;

      if (!isActive && !isUpcoming) {
        return null;
      }

      return {
        event,
        weight: isActive ? 2 : 1,
        distance: isActive ? 0 : startMs - nowMs
      };
    })
    .filter((entry): entry is { event: AppEvent; weight: number; distance: number } => Boolean(entry))
    .sort((left, right) => right.weight - left.weight || left.distance - right.distance);

  return entries[0]?.event ?? null;
}

function scoreProject(project: AdvisorProject, query: string, intent: IntentProfile): RankedProject | null {
  const corpus = buildCorpus(project);
  const normalizedQuery = normalize(query);
  const event = findBestEvent(project.id, Date.now());
  let score = 0;

  if (intent.categories.some((category) => project.categories.includes(category))) {
    score += 30;
  }
  if (project.isLive) {
    score += 12;
  }
  if (project.incentives?.length) {
    score += 12;
  }
  if (event) {
    score += 8;
  }

  const matchedKeywords = intent.keywords.filter((token) => token.length > 2 && corpus.includes(token));
  score += Math.min(18, matchedKeywords.length * 3);

  if (intent.strictLending) {
    if (/lending|borrow|loan|credit/.test(corpus)) {
      score += 40;
    } else if (project.categories.includes('DeFi')) {
      score += intent.preferIncentives && project.incentives?.length ? 10 : -6;
    } else {
      score -= 20;
    }
  }

  if (intent.strictBridge) {
    score += project.categories.includes('Bridge') ? 36 : -18;
  }

  if (intent.strictTrading) {
    score += project.categories.includes('Trading') ? 32 : -14;
  }

  if (intent.strictMobile) {
    score += project.categories.includes('Mobile') ? 28 : -12;
  }

  if (intent.strictAi) {
    score += project.categories.includes('AI') ? 28 : -12;
  }

  if (intent.preferLive && !project.isLive && !(project.incentives?.length) && !event) {
    score -= 8;
  }

  if (score < 18) {
    return null;
  }

  return {
    project,
    score,
    reason: buildReason(project, corpus, intent, event)
  };
}

function selectProjects(message: string, history: AdvisorChatMessage[]) {
  const query = [...history.filter((entry) => entry.role === 'user').slice(-2).map((entry) => entry.content), message].join(' ');
  const intent = detectIntent(query);

  return PROJECTS
    .map((project) => scoreProject(project, query, intent))
    .filter((entry): entry is RankedProject => Boolean(entry))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function buildContextBlock(projects: RankedProject[]) {
  const eventIds = new Set<string>();
  const nowMs = Date.now();

  const lines = projects.map(({ project, reason }) => {
    const event = findBestEvent(project.id, nowMs);
    if (event) {
      eventIds.add(event.id);
    }

    return [
      `Project: ${project.name} (${project.id})`,
      `Categories: ${project.categories.join(', ')}`,
      `Live: ${project.isLive ? 'yes' : 'no'}`,
      `Incentives: ${project.incentives?.map((entry) => entry.title).join(' | ') || 'none visible'}`,
      `Research note: ${project.jojoInsight ?? 'No extra editorial note available.'}`,
      `Event: ${event ? `${event.title} (${event.start}${event.end ? ` -> ${event.end}` : ''})` : 'none active or upcoming'}`,
      `Why selected: ${reason}`
    ].join('\n');
  });

  return {
    text: lines.join('\n\n'),
    sourceEventIds: [...eventIds]
  };
}

function sanitizeHistory(history: AdvisorChatMessage[]) {
  return history
    .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && entry.content.trim())
    .slice(-8)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 1800)
    }));
}

function readApiConfig(): ProviderConfig {
  const baseUrl = (process.env.AI_ADVISOR_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const apiKey = process.env.AI_ADVISOR_API_KEY?.trim();
  const model = process.env.AI_ADVISOR_MODEL?.trim() || DEFAULT_MODEL;
  const configuredProvider = process.env.AI_ADVISOR_PROVIDER?.trim().toLowerCase();
  const provider = configuredProvider === 'anthropic' || isAnthropicBaseUrl(baseUrl)
    ? 'anthropic'
    : 'openai-compatible';

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new AiAdvisorConfigError(
      'AI advisor is not configured. Set AI_ADVISOR_API_KEY, or point AI_ADVISOR_BASE_URL to a local OpenAI-compatible model endpoint such as Ollama.'
    );
  }

  return {
    apiKey,
    model,
    baseUrl,
    provider
  };
}

function buildPrompt(message: string, history: AdvisorChatMessage[], contextText: string) {
  const systemPrompt = [
    'You are the MegaBunnish AI advisor for the MegaETH ecosystem.',
    'Answer in English only.',
    'Use only the provided MegaBunnish context and conversation history.',
    'Never invent incentives, launches, token plans, live status, or opinions not grounded in the provided data.',
    'If the evidence is weak, say that directly.',
    'When recommending projects, explain the distinction between explicit fit and broader fallback options when relevant.',
    'Keep answers concise but useful, usually one short paragraph plus up to three bullet points if needed.'
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `MegaBunnish context:\n\n${contextText}` },
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user', content: message }
  ];

  return messages;
}

async function requestCompletion(messages: Array<{ role: string; content: string }>) {
  const config = readApiConfig();

  if (config.provider === 'anthropic') {
    return requestAnthropicCompletion(config, messages);
  }

  return requestOpenAiCompatibleCompletion(config, messages);
}

async function requestOpenAiCompatibleCompletion(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI advisor request failed (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((entry) => (entry.type === 'text' || !entry.type ? entry.text ?? '' : ''))
      .join('')
      .trim();
    if (text) {
      return text;
    }
  }

  throw new Error('AI advisor returned an empty response.');
}

async function requestAnthropicCompletion(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>
) {
  if (!config.apiKey) {
    throw new AiAdvisorConfigError('Anthropic requires AI_ADVISOR_API_KEY.');
  }

  const systemMessages = messages.filter((entry) => entry.role === 'system');
  const userAssistantMessages = messages.filter((entry) => entry.role !== 'system');
  const systemPrompt = systemMessages.map((entry) => entry.content).join('\n\n');

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 700,
      temperature: 0.2,
      system: systemPrompt,
      messages: userAssistantMessages.map((entry) => ({
        role: entry.role,
        content: entry.content
      }))
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI advisor request failed (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = payload.content
    ?.map((entry) => (entry.type === 'text' || !entry.type ? entry.text ?? '' : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('AI advisor returned an empty response.');
  }

  return text;
}

export async function generateAiAdvisorReply(input: {
  message: string;
  history?: AdvisorChatMessage[];
  conversationId?: string;
}): Promise<AdvisorReply> {
  const message = input.message.trim();
  if (!message) {
    throw new Error('Message is required.');
  }

  const history = sanitizeHistory(input.history ?? []);
  const rankedProjects = selectProjects(message, history);
  const context = buildContextBlock(rankedProjects);
  const promptMessages = buildPrompt(message, history, context.text);
  const answer = await requestCompletion(promptMessages);

  return {
    answer,
    conversationId: input.conversationId?.trim() || randomUUID(),
    recommendations: rankedProjects.slice(0, 4).map(({ project, reason }) => ({
      projectId: project.id,
      reason
    })),
    sourceProjectIds: rankedProjects.map(({ project }) => project.id),
    sourceEventIds: context.sourceEventIds,
    suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS
  };
}