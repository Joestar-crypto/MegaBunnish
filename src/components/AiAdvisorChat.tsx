import { useEffect, useMemo, useRef, useState } from 'react';
import { ETHOS_PROFILE_OVERRIDES } from '../data/ethosManualProfiles';
import { useConstellation } from '../state/constellation';

type AiAdvisorChatProps = {
  isInteracting?: boolean;
};

type ChatRole = 'user' | 'assistant';

type ApiRecommendation = {
  projectId: string;
  reason: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  recommendations?: ApiRecommendation[];
  isError?: boolean;
};

type RecommendationProject = {
  project: ReturnType<typeof useConstellation>['allProjects'][number];
  reason: string;
  ethosScore?: number;
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

type AdvisorResponse = {
  ok?: boolean;
  answer?: string;
  error?: string;
  conversationId?: string;
  recommendations?: ApiRecommendation[];
  suggestedPrompts?: string[];
  budget?: BudgetStatus;
};

type SessionGuardState = {
  totalSent: number;
  sentTimestamps: number[];
  lastSentAt: number;
  lastMessage: string;
  cooldownUntil: number;
  dayKey: string;
};

const API_URL =
  import.meta.env.VITE_AI_ADVISOR_API_URL?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:3000/api/ai-chat' : '/api/ai-chat');
const CONVERSATION_STORAGE_KEY = 'megabunnish-ai-conversation-id';
const SESSION_GUARD_STORAGE_KEY = 'megabunnish-ai-session-guard';
const SESSION_MESSAGE_LIMIT = 30;
const WINDOW_MESSAGE_LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000;
const RAPID_FIRE_LIMIT = 5;
const RAPID_FIRE_WINDOW_MS = 10 * 1000;
const RAPID_FIRE_COOLDOWN_MS = 2 * 60 * 1000;
const MIN_SEND_INTERVAL_MS = 1500;
const MIN_MESSAGE_LENGTH = 3;
const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGE_LENGTH_SENT = 400;
const MAX_HISTORY_MESSAGES = 6;
const STARTER_PROMPTS = [
  'Which incentivized Wave 1 apps on Terminal should I farm first?',
  'How do Terminal points and boosters actually work?',
  'How do I maximise my Terminal multiplier with weekly app selection?',
  'Should I pledge to an NFT clan this week?',
  'Which lending protocol looks strongest on MegaETH right now?',
  'Which bridge should I use to move into MegaETH?',
  'Which mobile-first app should I try first?'
];

const ETHOS_SCORE_FALLBACK = new Map(
  ETHOS_PROFILE_OVERRIDES.filter((entry) => entry.projectId).map((entry) => [entry.projectId as string, entry.score])
);

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

const getEthosTier = (score: number): 'untrusted' | 'questionable' | 'neutral' | 'reputable' | 'exemplary' | 'revered' => {
  if (!Number.isFinite(score)) return 'neutral';
  if (score < 800) return 'untrusted';
  if (score < 1200) return 'questionable';
  if (score < 1400) return 'neutral';
  if (score < 1600) return 'reputable';
  if (score < 1800) return 'exemplary';
  return 'revered';
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-intro',
  role: 'assistant',
  content:
    'Ask me anything about the MegaETH ecosystem. I answer from the projects and event data already present in MegaBunnish, and I will say when the evidence is thin.'
};

const DEFAULT_SESSION_GUARD_STATE: SessionGuardState = {
  totalSent: 0,
  sentTimestamps: [],
  lastSentAt: 0,
  lastMessage: '',
  cooldownUntil: 0,
  dayKey: ''
};

function getCurrentDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readSessionGuardState(): SessionGuardState {
  const storage = getSessionStorage();
  if (!storage) {
    return DEFAULT_SESSION_GUARD_STATE;
  }

  try {
    const raw = storage.getItem(SESSION_GUARD_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SESSION_GUARD_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<SessionGuardState>;
    const today = getCurrentDayKey();
    const storedDayKey = typeof parsed.dayKey === 'string' ? parsed.dayKey : '';
    const isSameDay = storedDayKey === today;
    return {
      totalSent: isSameDay ? Number(parsed.totalSent ?? 0) || 0 : 0,
      sentTimestamps: Array.isArray(parsed.sentTimestamps)
        ? parsed.sentTimestamps.filter((value): value is number => typeof value === 'number')
        : [],
      lastSentAt: Number(parsed.lastSentAt ?? 0) || 0,
      lastMessage: typeof parsed.lastMessage === 'string' ? parsed.lastMessage : '',
      cooldownUntil: Number(parsed.cooldownUntil ?? 0) || 0,
      dayKey: today
    };
  } catch {
    return DEFAULT_SESSION_GUARD_STATE;
  }
}

function persistSessionGuardState(next: SessionGuardState) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SESSION_GUARD_STORAGE_KEY, JSON.stringify(next));
}

function formatCountdown(target: number, now: number) {
  const diffMs = Math.max(0, target - now);
  const totalSeconds = Math.ceil(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function getMinutesUntil(timestamp: number, now: number) {
  return Math.max(1, Math.ceil((timestamp - now) / 60000));
}

function getUtcResetCountdown(isoString: string | undefined, now: number) {
  if (!isoString) {
    return '';
  }

  const target = new Date(isoString).getTime();
  if (!Number.isFinite(target) || target <= now) {
    return '';
  }

  return formatCountdown(target, now);
}

export const AiAdvisorChat = ({ isInteracting = false }: AiAdvisorChatProps) => {
  const { allProjects, ethosScores, selectedProjectId, selectProject } = useConstellation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(STARTER_PROMPTS);
  const [showStarterPrompts, setShowStarterPrompts] = useState(false);
  const [sessionGuard, setSessionGuard] = useState<SessionGuardState>(DEFAULT_SESSION_GUARD_STATE);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedProjectIdRef = useRef<string | null>(null);
  const restoreAfterDetailCloseRef = useRef(false);
  const preservedScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    const storage = getSessionStorage();
    const storedConversationId = storage?.getItem(CONVERSATION_STORAGE_KEY);
    if (storedConversationId) {
      setConversationId(storedConversationId);
    }

    // Legacy cleanup: older builds stored session-only chat state in
    // localStorage, which prevented the daily message quota from resetting on
    // a fresh browser session.
    window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEY);

    setSessionGuard(readSessionGuardState());
  }, []);

  useEffect(() => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    if (!conversationId) {
      storage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }

    storage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    persistSessionGuardState(sessionGuard);
  }, [sessionGuard]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (preservedScrollTopRef.current !== null && bodyRef.current) {
      bodyRef.current.scrollTop = preservedScrollTopRef.current;
      preservedScrollTopRef.current = null;
      return;
    }

    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    const previousSelectedProjectId = previousSelectedProjectIdRef.current;
    previousSelectedProjectIdRef.current = selectedProjectId;

    if (!restoreAfterDetailCloseRef.current) {
      return;
    }

    if (previousSelectedProjectId && !selectedProjectId) {
      restoreAfterDetailCloseRef.current = false;
      setIsOpen(true);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  async function refreshBudgetStatus() {
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { budget?: BudgetStatus };
      if (payload.budget) {
        setBudgetStatus(payload.budget);
      }
    } catch {
      // Keep chat usable if the budget status endpoint is temporarily unavailable.
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void refreshBudgetStatus();
  }, [isOpen]);

  const hasUserMessages = useMemo(() => messages.some((entry) => entry.role === 'user'), [messages]);
  const recentWindowTimestamps = useMemo(
    () => sessionGuard.sentTimestamps.filter((timestamp) => clockMs - timestamp < WINDOW_MS),
    [clockMs, sessionGuard.sentTimestamps]
  );
  const rapidFireTimestamps = useMemo(
    () => sessionGuard.sentTimestamps.filter((timestamp) => clockMs - timestamp < RAPID_FIRE_WINDOW_MS),
    [clockMs, sessionGuard.sentTimestamps]
  );
  const remainingSessionMessages = Math.max(0, SESSION_MESSAGE_LIMIT - sessionGuard.totalSent);
  const windowLimitedUntil = recentWindowTimestamps.length >= WINDOW_MESSAGE_LIMIT ? recentWindowTimestamps[0] + WINDOW_MS : 0;
  const spamCooldownActive = sessionGuard.cooldownUntil > clockMs;
  const hardDailyLimitReached = Boolean(budgetStatus?.blocked);
  const windowCooldownActive = windowLimitedUntil > clockMs;
  const dailyResetCountdown = getUtcResetCountdown(budgetStatus?.resetsAtUtc, clockMs);
  const bannerMessage = hardDailyLimitReached
    ? `Daily limit reached, back tomorrow${dailyResetCountdown ? ` (${dailyResetCountdown})` : ''}.`
    : spamCooldownActive
      ? `Too many rapid sends. Come back in ${formatCountdown(sessionGuard.cooldownUntil, clockMs)}.`
      : windowCooldownActive
        ? `You've reached the limit, come back in ${formatCountdown(windowLimitedUntil, clockMs)}.`
      : budgetStatus?.warning
        ? 'High traffic today, responses may be slower.'
        : null;

  function pushLocalAssistantMessage(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-local-${Date.now()}`,
        role: 'assistant',
        content,
        isError: true
      }
    ]);
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    const now = Date.now();

    if (!message || isLoading) {
      return;
    }

    if (hardDailyLimitReached) {
      pushLocalAssistantMessage(`Daily limit reached, back tomorrow${dailyResetCountdown ? ` (${dailyResetCountdown})` : ''}.`);
      return;
    }

    if (honeypot.trim()) {
      pushLocalAssistantMessage('That send looked automated, so I ignored it.');
      return;
    }

    if (message.length < MIN_MESSAGE_LENGTH) {
      pushLocalAssistantMessage('Make it at least 3 characters so I have something real to work with.');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      pushLocalAssistantMessage('Keep it under 500 characters and I am in.');
      return;
    }

    if (message === sessionGuard.lastMessage) {
      pushLocalAssistantMessage('Same exact prompt twice in a row is blocked. Tweak it a bit and send again.');
      return;
    }

    if (now - sessionGuard.lastSentAt < MIN_SEND_INTERVAL_MS) {
      pushLocalAssistantMessage('Slow down a touch. Wait 1.5 seconds between sends.');
      return;
    }

    if (sessionGuard.totalSent >= SESSION_MESSAGE_LIMIT) {
      pushLocalAssistantMessage(`You have used all ${SESSION_MESSAGE_LIMIT} messages for today. Come back tomorrow to keep going.`);
      return;
    }

    if (windowLimitedUntil > now) {
      pushLocalAssistantMessage(`You\'ve reached the limit, come back in ${formatCountdown(windowLimitedUntil, now)}.`);
      return;
    }

    if (spamCooldownActive) {
      pushLocalAssistantMessage(`You\'ve hit the cooldown. Come back in ${formatCountdown(sessionGuard.cooldownUntil, now)}.`);
      return;
    }

    if (rapidFireTimestamps.length >= RAPID_FIRE_LIMIT) {
      const nextState = {
        ...sessionGuard,
        cooldownUntil: now + RAPID_FIRE_COOLDOWN_MS
      };
      setSessionGuard(nextState);
      pushLocalAssistantMessage(`You\'ve hit the cooldown. Come back in ${formatCountdown(nextState.cooldownUntil, now)}.`);
      return;
    }

    const trimmedMessage = message.slice(0, MAX_MESSAGE_LENGTH_SENT);
    const nextSessionGuard: SessionGuardState = {
      totalSent: sessionGuard.totalSent + 1,
      sentTimestamps: [...sessionGuard.sentTimestamps, now].filter((timestamp) => now - timestamp < WINDOW_MS),
      lastSentAt: now,
      lastMessage: message,
      cooldownUntil: 0,
      dayKey: getCurrentDayKey()
    };

    // Local protection layer: session quota, rolling windows, duplicate blocking, and cooldowns.
    setSessionGuard(nextSessionGuard);

    const history = messages.map(({ role, content }) => ({ role, content })).slice(-MAX_HISTORY_MESSAGES);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedMessage
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setHoneypot('');
    setShowStarterPrompts(false);
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmedMessage,
          history,
          conversationId,
          honeypot
        })
      });

      const responseText = await response.text();
      let payload: AdvisorResponse = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText) as AdvisorResponse;
        } catch {
          throw new Error(
            response.ok
              ? 'The AI advisor returned an invalid response.'
              : `The AI advisor request failed with status ${response.status}.`
          );
        }
      }

      if (payload.budget) {
        setBudgetStatus(payload.budget);
      }

      const answer = payload.answer;
      if (!response.ok || !answer) {
        throw new Error(
          payload.error ||
            (response.ok
              ? 'The AI advisor could not answer right now.'
              : `The AI advisor request failed with status ${response.status}.`)
        );
      }

      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }

      if (payload.suggestedPrompts?.length) {
        setSuggestedPrompts(payload.suggestedPrompts);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          recommendations: payload.recommendations ?? []
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error ? error.message : 'The AI advisor could not answer right now.',
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
      void refreshBudgetStatus();
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const handleProjectOpen = (projectId: string) => {
    preservedScrollTopRef.current = bodyRef.current?.scrollTop ?? null;
    restoreAfterDetailCloseRef.current = true;
    selectProject(projectId);
    setIsOpen(false);
  };

  return (
    <div className="ai-chat-shell">
      <button
        type="button"
        className={`ai-chat-launcher ${!isOpen && isInteracting ? 'ui-panel--hidden' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="ai-advisor-panel"
      >
        <span className="ai-chat-launcher__spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <defs>
              <linearGradient id="gemini-button-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#71a7ff" />
                <stop offset="0.52" stopColor="#9c89ff" />
                <stop offset="1" stopColor="#71dfd1" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.8c.52 3.04 1.26 4.92 2.3 5.96 1.05 1.04 2.92 1.78 5.96 2.3-3.04.52-4.91 1.26-5.96 2.3-1.04 1.05-1.78 2.92-2.3 5.96-.52-3.04-1.26-4.91-2.3-5.96-1.05-1.04-2.92-1.78-5.96-2.3 3.04-.52 4.91-1.26 5.96-2.3 1.04-1.04 1.78-2.92 2.3-5.96Z"
              fill="url(#gemini-button-gradient)"
            />
          </svg>
        </span>
        <span className="ai-chat-launcher__label">{isOpen ? 'Close AI' : 'Ask AI'}</span>
      </button>
      <aside
        id="ai-advisor-panel"
        className={`ai-chat-panel ${isOpen ? 'ai-chat-panel--open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="ai-chat-panel__header">
          <div>
            <p className="ai-chat-panel__eyebrow">AI advisor</p>
            <h2>MegaETH chat</h2>
            <p className="ai-chat-panel__usage">{remainingSessionMessages}/{SESSION_MESSAGE_LIMIT} messages left</p>
            {windowCooldownActive ? (
              <p className="ai-chat-panel__cooldown">Rolling limit resets in {formatCountdown(windowLimitedUntil, clockMs)}</p>
            ) : null}
            {hardDailyLimitReached && dailyResetCountdown ? (
              <p className="ai-chat-panel__cooldown">Daily budget resets in {dailyResetCountdown}</p>
            ) : null}
          </div>
          <button type="button" className="ai-chat-panel__close" onClick={() => setIsOpen(false)} aria-label="Close AI chat">
            x
          </button>
        </div>
        <div className="ai-chat-panel__body" ref={bodyRef}>
          {bannerMessage ? (
            <div className={`ai-chat-banner ${hardDailyLimitReached ? 'ai-chat-banner--error' : ''}`}>{bannerMessage}</div>
          ) : null}

          {!hasUserMessages ? (
            <section className="ai-chat-empty">
              <h3>Ask about lending, bridges, live DeFi, mobile apps, or any other MegaETH niche.</h3>
              <p>
                This chat uses the projects and event data already inside MegaBunnish, so it stays grounded in the site instead of guessing from nowhere.
              </p>
              <div className="ai-chat-starters">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setShowStarterPrompts(false);
                      void sendMessage(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {hasUserMessages && showStarterPrompts ? (
            <section className="ai-chat-prompt-picker">
              <div className="ai-chat-prompt-picker__header">
                <p>Starter questions</p>
                <button type="button" onClick={() => setShowStarterPrompts(false)}>
                  Hide
                </button>
              </div>
              <div className="ai-chat-starters">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={`picker-${prompt}`}
                    type="button"
                    onClick={() => {
                      setShowStarterPrompts(false);
                      void sendMessage(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="ai-chat-thread">
            {messages.map((message) => {
              const recommendationProjects = (message.recommendations ?? []).reduce<RecommendationProject[]>(
                (acc, entry) => {
                  const project = allProjects.find((candidate) => candidate.id === entry.projectId);
                  if (!project) {
                    return acc;
                  }

                  const ethosScore = ethosScores[project.id] ?? ETHOS_SCORE_FALLBACK.get(project.id);
                  acc.push({ project, reason: entry.reason, ethosScore });
                  return acc;
                },
                []
              );

              return (
                <article key={message.id} className={`ai-chat-message ai-chat-message--${message.role}`}>
                  <p className={message.isError ? 'ai-chat-message__bubble ai-chat-message__bubble--error' : 'ai-chat-message__bubble'}>
                    {message.content}
                  </p>
                  {recommendationProjects.length ? (
                    <div className="ai-chat-message__grid">
                      {recommendationProjects.map(({ project, reason, ethosScore }) => (
                        <section key={project.id} className="ai-recommendation-card">
                          <div className="ai-recommendation-card__topline">
                            <div className="ai-recommendation-card__badges">
                              <span className="ai-recommendation-card__score">{project.primaryCategory}</span>
                            </div>
                          </div>
                          <div className="ai-recommendation-card__title">
                            <button
                              type="button"
                              className="ai-recommendation-card__project-link"
                              onClick={() => handleProjectOpen(project.id)}
                              aria-label={`Open ${project.name} details`}
                              title={`Open ${project.name} details`}
                            >
                              <img src={project.logo} alt="" aria-hidden="true" />
                            </button>
                            <div>
                              <div className="ai-recommendation-card__heading-row">
                                <strong>{project.name}</strong>
                                {typeof ethosScore === 'number' ? (
                                  <span
                                    className={`ai-recommendation-card__ethos-inline ai-recommendation-card__ethos-inline--${getEthosTier(ethosScore)}`}
                                    title={`Ethos trust score ${ethosScore}`}
                                  >
                                    <img src="/logos/Ethos.webp" alt="" aria-hidden="true" />
                                    <span>{ethosScore}</span>
                                  </span>
                                ) : null}
                                {project.links.twitter ? (
                                  <a
                                    className="ai-recommendation-card__x-link"
                                    href={project.links.twitter}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    aria-label={`Open ${project.name} on X`}
                                    title={`Open ${project.name} on X`}
                                  >
                                    <span aria-hidden="true">X</span>
                                  </a>
                                ) : null}
                              </div>
                              <span>{project.categories.join(' · ')}</span>
                            </div>
                          </div>
                          <p>{reason}</p>
                        </section>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}

            {isLoading ? (
              <article className="ai-chat-message ai-chat-message--assistant">
                <p className="ai-chat-message__bubble ai-chat-message__bubble--pending">Thinking...</p>
              </article>
            ) : null}
          </div>
        </div>
        <div className="ai-chat-composer">
          <div className="ai-chat-composer__toolbar">
            {hasUserMessages ? (
              <button type="button" className="ai-chat-composer__secondary" onClick={() => setShowStarterPrompts((current) => !current)}>
                {showStarterPrompts ? 'Hide starter prompts' : 'Starter prompts'}
              </button>
            ) : null}
            <span className="ai-chat-composer__meta">{recentWindowTimestamps.length}/{WINDOW_MESSAGE_LIMIT} used in the last 10 min</span>
          </div>
          <form className="ai-chat-composer__form" onSubmit={handleSubmit}>
            <input
              className="ai-chat-composer__input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Ask something like: which lending protocol should I farm?"
              disabled={isLoading || hardDailyLimitReached || spamCooldownActive}
            />
            <input
              className="ai-chat-composer__honeypot"
              type="text"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <button type="submit" disabled={isLoading || hardDailyLimitReached || spamCooldownActive || !input.trim()}>
              {hardDailyLimitReached ? 'Closed' : isLoading ? 'Thinking...' : 'Send'}
            </button>
          </form>
          <div className="ai-chat-composer__footer">
            <span>{Math.max(0, MAX_MESSAGE_LENGTH - input.length)}/{MAX_MESSAGE_LENGTH} chars left</span>
            {input.trim().length > MAX_MESSAGE_LENGTH_SENT ? <span>Long prompts are trimmed to 400 chars before sending.</span> : null}
          </div>
        </div>
      </aside>
    </div>
  );
};