import { useEffect, useMemo, useRef, useState } from 'react';
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

type AdvisorResponse = {
  ok?: boolean;
  answer?: string;
  error?: string;
  conversationId?: string;
  recommendations?: ApiRecommendation[];
  suggestedPrompts?: string[];
};

const API_URL =
  import.meta.env.VITE_AI_ADVISOR_API_URL?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:3000/api/ai-chat' : '/api/ai-chat');
const CONVERSATION_STORAGE_KEY = 'megabunnish-ai-conversation-id';
const STARTER_PROMPTS = [
  'Which lending protocol looks strongest on MegaETH right now?',
  'Compare the safest DeFi options for a new user.',
  'Which bridge should I use to move into MegaETH?',
  'Which mobile-first app should I try first?'
];

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-intro',
  role: 'assistant',
  content:
    'Ask me anything about the MegaETH ecosystem. I answer from the projects and event data already present in MegaBunnish, and I will say when the evidence is thin.'
};

export const AiAdvisorChat = ({ isInteracting = false }: AiAdvisorChatProps) => {
  const { allProjects, selectProject } = useConstellation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(STARTER_PROMPTS);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedConversationId = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (storedConversationId) {
      setConversationId(storedConversationId);
    }
  }, []);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages, isLoading]);

  const hasUserMessages = useMemo(() => messages.some((entry) => entry.role === 'user'), [messages]);

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

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || isLoading) {
      return;
    }

    const history = messages.map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          history,
          conversationId
        })
      });

      const payload = (await response.json()) as AdvisorResponse;
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || 'The AI advisor could not answer right now.');
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
          content: payload.answer,
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
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  return (
    <>
      <button
        type="button"
        className={`ai-chat-launcher ${!isOpen && isInteracting ? 'ui-panel--hidden' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="ai-advisor-panel"
      >
        <span className="ai-chat-launcher__spark" aria-hidden="true">
          AI
        </span>
        <span>{isOpen ? 'Close chat' : 'Ask AI'}</span>
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
          </div>
          <button type="button" className="ai-chat-panel__close" onClick={() => setIsOpen(false)} aria-label="Close AI chat">
            x
          </button>
        </div>
        <div className="ai-chat-panel__body" ref={bodyRef}>
          {!hasUserMessages ? (
            <section className="ai-chat-empty">
              <h3>Ask about lending, bridges, live DeFi, mobile apps, or any other MegaETH niche.</h3>
              <p>
                This chat uses the projects and event data already inside MegaBunnish, so it stays grounded in the site instead of guessing from nowhere.
              </p>
              <div className="ai-chat-starters">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="ai-chat-thread">
            {messages.map((message) => {
              const recommendationProjects = (message.recommendations ?? [])
                .map((entry) => {
                  const project = allProjects.find((candidate) => candidate.id === entry.projectId);
                  return project ? { project, reason: entry.reason } : null;
                })
                .filter((entry): entry is { project: (typeof allProjects)[number]; reason: string } => Boolean(entry));

              return (
                <article key={message.id} className={`ai-chat-message ai-chat-message--${message.role}`}>
                  <p className={message.isError ? 'ai-chat-message__bubble ai-chat-message__bubble--error' : 'ai-chat-message__bubble'}>
                    {message.content}
                  </p>
                  {recommendationProjects.length ? (
                    <div className="ai-chat-message__grid">
                      {recommendationProjects.map(({ project, reason }) => (
                        <section key={project.id} className="ai-recommendation-card">
                          <div className="ai-recommendation-card__topline">
                            <span className="ai-recommendation-card__quality">
                              {project.isLive ? 'Live' : project.incentives.length ? 'Incentivized' : 'Watchlist'}
                            </span>
                            <span className="ai-recommendation-card__score">{project.primaryCategory}</span>
                          </div>
                          <div className="ai-recommendation-card__title">
                            <img src={project.logo} alt="" aria-hidden="true" />
                            <div>
                              <strong>{project.name}</strong>
                              <span>{project.categories.join(' · ')}</span>
                            </div>
                          </div>
                          <p>{reason}</p>
                          <div className="ai-recommendation-card__meta">
                            {project.isLive ? <span>Live now</span> : null}
                            {project.incentives.length ? <span>{project.incentives[0].title}</span> : null}
                          </div>
                          <div className="ai-recommendation-card__actions">
                            <button
                              type="button"
                              onClick={() => {
                                selectProject(project.id);
                                setIsOpen(false);
                              }}
                            >
                              Open project
                            </button>
                            {project.links.site ? (
                              <a href={project.links.site} target="_blank" rel="noreferrer noopener">
                                Visit site
                              </a>
                            ) : project.links.twitter ? (
                              <a href={project.links.twitter} target="_blank" rel="noreferrer noopener">
                                Open X
                              </a>
                            ) : null}
                          </div>
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
          <form className="ai-chat-composer__form" onSubmit={handleSubmit}>
            <input
              className="ai-chat-composer__input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask something like: which lending protocol should I farm?"
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      </aside>
    </>
  );
};