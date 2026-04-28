import { randomUUID } from 'node:crypto';
import { APP_EVENTS, type AppEvent } from '../src/data/appEvents';
import { ETHOS_PROFILE_OVERRIDES } from '../src/data/ethosManualProfiles';
import { JOJO_SCORES_BY_PROJECT_ID } from '../src/data/jojoScores';
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

type VerticalMatch = {
  category: string;
  label: string;
};

type IntentProfile = {
  categories: string[];
  verticals: VerticalMatch[];
  // Strict bonuses kept for the two verticals that need extra subtype scoring.
  strictLending: boolean;
  strictRwa: boolean;
  preferLive: boolean;
  preferIncentives: boolean;
  preferSafety: boolean;
  preferBeginnerFriendly: boolean;
  preferNative: boolean;
  wantsNftCollections: boolean;
  wantsGeneralChainInfo: boolean;
  // Narrative buckets (TCG, perp DEX, spot DEX, …) detected in the query.
  // Independent of `categories` because they slice across or through them.
  narratives: NarrativeMatch[];
  keywords: string[];
};

type NarrativeMatch = {
  id: string;
  label: string;
};

// Narrative buckets are sub-categories or cross-cutting themes that are NOT
// represented as a `categories` value in projects.json. The `corpusPattern`
// is matched against the per-project corpus (name + id + categories + links
// + jojoInsight). When a narrative is detected in the query, every project
// whose corpus matches the corpusPattern is force-included in the result
// list — even if its score would otherwise be too low — so the user gets
// the FULL set of relevant apps for that narrative, not just the top 1.
const NARRATIVE_BUCKETS: Array<{
  id: string;
  label: string;
  queryPattern: RegExp;
  corpusPattern: RegExp;
  excludeCorpus?: RegExp;
}> = [
  {
    id: 'tcg',
    label: 'TCG / trading card / gacha',
    queryPattern: /\b(tcg|tcgs|trading card|trading cards|card game|card games|gacha)\b/,
    corpusPattern: /\b(tcg|trading card|card game|gacha)\b/
  },
  {
    id: 'perp-dex',
    label: 'perp DEX / perpetuals',
    queryPattern: /\b(perp|perps|perpetual|perpetuals|perp dex|perpetual dex|leverage trading|futures)\b/,
    corpusPattern: /\b(perp|perps|perpetual|perpetuals|leverage|futures)\b/
  },
  {
    id: 'spot-dex',
    label: 'spot DEX / swap / AMM',
    queryPattern: /\b(spot dex|spot trading|swap|swaps|amm|order ?book|spot market)\b/,
    corpusPattern: /\b(spot|swap|amm|order ?book|dex)\b/,
    // A perp DEX is not a spot DEX. Exclude projects whose corpus is
    // dominated by perp/leverage language.
    excludeCorpus: /\b(perp|perps|perpetual|perpetuals|leverage|futures)\b/
  }
];

// Projects in the dataset that are NFT marketplaces or aggregators rather
// than mintable NFT collections. When the user asks for collections to buy or
// mint, these should not be surfaced as collections.
const NFT_MARKETPLACE_IDS = new Set<string>(['opensea', 'rarible', 'nextrare', 'magiceden']);

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

type EthosProfile = {
  score: number;
  tier?: string;
  url?: string;
};

const PROJECTS = rawProjects as AdvisorProject[];
const ETHOS_BY_PROJECT_ID = new Map<string, EthosProfile>(
  ETHOS_PROFILE_OVERRIDES.filter((entry) => entry.projectId).map((entry) => [
    entry.projectId as string,
    {
      score: entry.score,
      tier: entry.tier,
      url: entry.url
    }
  ])
);

// BadBunnz family = the BadBunnz NFT itself plus every project that links to
// it (via linkedIds, in either direction). Membership earns a small score
// boost and a "BadBunnz family: yes" line in the LLM context, matching how
// Jojo treats them as lower-risk MegaETH-native picks.
const BAD_BUNNZ_ID = 'bad-bunnz';
const BADBUNNZ_FAMILY_IDS: Set<string> = (() => {
  const ids = new Set<string>([BAD_BUNNZ_ID]);
  const badBunnz = PROJECTS.find((project) => project.id === BAD_BUNNZ_ID);
  for (const linkedId of badBunnz?.linkedIds ?? []) {
    ids.add(linkedId);
  }
  for (const project of PROJECTS) {
    if (project.linkedIds?.includes(BAD_BUNNZ_ID)) {
      ids.add(project.id);
    }
  }
  return ids;
})();

function isMegamafiaProject(project: AdvisorProject) {
  return project.categories.includes('Megamafia');
}

function isBadbunnzFamily(project: AdvisorProject) {
  return BADBUNNZ_FAMILY_IDS.has(project.id);
}

// MegaETH-native projects are the ones where farming, points, and early
// engagement actually pay off. Anything outside this trio (i.e. infra apps
// like Aave, GMX, Lido, Stargate, OpenSea, generic bridges) is treated as
// non-native and is de-prioritized in the recommendation ranking.
function isNativeMegaEthProject(project: AdvisorProject) {
  return (
    project.categories.includes('Native') ||
    project.categories.includes('Megamafia') ||
    project.categories.includes('Jojo')
  );
}
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_SUGGESTED_PROMPTS = [
  'Which lending protocol looks strongest on MegaETH right now?',
  'Compare the safest DeFi options for a new user.',
  'Which bridge should I use to move into MegaETH?',
  'Which mobile-first app should I try first?',
  'How does MegaETH differ from a typical Ethereum L2?',
  'Which incentivized Wave 1 apps on Terminal should I farm first?',
  'How do Terminal points and boosters actually work?',
  'Should I pledge to an NFT clan this week, and how do I pick one?',
  'How do I maximise my Terminal multiplier with weekly app selection?',
  'Which boosters can I still unlock after TGE?'
];

const GENERAL_MEGAETH_CONTEXT = [
  'MegaETH is presented in its official docs as a high-performance Ethereum L2 and the first real-time blockchain.',
  'Official site claims include 100,000+ transactions per second, 10+ Ggas per second, and sub-10 ms block times.',
  'Official docs describe mini-blocks every ~10 ms for fast confirmations and standard EVM blocks every ~1 second for Ethereum compatibility.',
  'Mini-blocks are MegaETH-specific, while EVM blocks stay standard Ethereum format so normal wallets, indexers, and toolchains still work.',
  'Docs say each transaction appears in exactly one mini-block and one EVM block, with mini-blocks mainly improving latency.',
  'MegaETH docs say applications can subscribe to mini-blocks through a Realtime API for millisecond-level updates.',
  'Architecture docs say the sequencer executes transactions, streams mini-block results to RPC nodes, and settles to Ethereum L1.',
  'Docs describe globally distributed RPC nodes, including lightweight replica nodes and full nodes that re-execute blocks independently.',
  'MegaETH docs say block data is posted via EigenDA and disputes are resolved on Ethereum using the OP Stack fault-proof framework, with Kailua mentioned as the ZK fraud-proof system.',
  'Official developer docs describe MegaEVM as fully compatible with Ethereum smart contracts, but note some differences such as a dual gas model.',
  'The formal spec says MegaETH adds a dual gas model, multidimensional resource limits, gas detention, dynamic storage pricing, and system contracts for oracle storage, timestamps, deployment, and runtime controls.',
  'The formal spec says transactions that do not touch MegaETH-specific features behave identically to Optimism-compatible EVM semantics unless explicitly overridden.',
  'Official docs warn that standard Ethereum toolchains may underestimate gas on MegaETH, so gas estimation should use a MegaETH RPC endpoint.',
  'Official docs say managed RPC providers can expose higher-throughput and debug methods such as debug_traceTransaction.',
  'Official docs describe the canonical bridge as the preferred path for bridging ETH from Ethereum to MegaETH.',
  'The developer docs list the Ethereum mainnet side of the canonical bridge at 0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75.',
  'Official connect docs say public RPC access exists but is rate-limited, and they point users to uptime.megaeth.com for live network status.',
  'Official connect docs reference Blockscout and Etherscan explorers for MegaETH mainnet.',
  'MegaETH docs emphasize real-time UX for trading, gaming, live feeds, and apps that need millisecond-level responsiveness.',
  'The research article says MegaETH focuses on node specialization with sequencers, provers, full nodes, and replica nodes rather than a one-size-fits-all node design.',
  'The research article says replica nodes apply streamed state diffs without re-executing transactions, while full nodes re-execute blocks and provers validate blocks asynchronously.',
  'The research article frames MegaETH as a performance-centric design that centralizes block production while keeping validation trustless and decentralized through specialized roles.',
  'The research article discusses RAM-heavy sequencer machines, low-cost prover nodes, lighter replica nodes, and more capable full nodes as part of that specialization model.',
  'The research article says MegaETH was designed to support real-time workloads such as high-frequency trading, gaming, autonomous worlds, and other fast-feedback applications.',
  'Official site describes MegaMafia as an early-stage founder collective building new apps that showcase what MegaETH unlocks.',
  'The public sale article says the MEGA public sale on Sonar used a ceiling valuation of $999M.',
  'The public sale article says oversubscribed sales use a U-shaped allocation model intended to balance broad distribution with contributor priority.',
  'The public sale article says at least 5,000 participants receive baseline allocations starting at $2,650 in that oversubscription framework.',
  'The public sale article says additional tokens on mainnet are reserved for people who attempted to participate in the Sonar, Echo, and Fluffle sales.',
  'The public sale article says MegaETH wants non-insider investors to become the single largest stakeholder group, larger than the VCs and the team.',
  'The public sale article explicitly positions MEGA holders, users, and users who also become investors as distinct stakeholder groups.',
  'The public sale article mentions prior fundraising from investors such as Dragonfly and Vitalik Buterin, alongside more than 3,000 Echo users.',
  'The token page currently shows a MEGA TGE page and app KPI framing, but the loaded public page fragment does not provide a full token allocation table or supply breakdown.',
  'The current official pages loaded here do not provide a verified total token supply number, detailed vesting schedule, or full token allocation percentages.',
  'If asked about tokenomics, answer with the published sale mechanics, the implied 10B MEGA total supply derived from the $0.0999 ceiling and $999M FDV cap, and explicitly say that detailed allocation percentages and the full vesting schedule are not specified in the currently loaded official context.',
  'The USDm launch article says USDm is a native stablecoin on MegaETH issued through Ethena infrastructure and designed to align incentives across the network.',
  'The USDm article says reserve yield is intended to help cover sequencer operating costs so gas can be priced at cost rather than with an added sequencer margin.',
  'The USDm article says USDm v1 starts on Ethena USDtb rails, while USDT0 and cUSD remain supported as first-class stablecoins on MegaETH.',
  'The user FAQ says RPC links return 405 in browsers because they expect POST requests from wallets or tools rather than GET requests from browsers.',
  'The user FAQ says the testnet faucet is capped at 0.005 testnet ETH per user every 24 hours and remains testnet-only after mainnet.',
  'The official Sonar public sale page at token.megaeth.com states a max FDV cap of $999,000,000 and a ceiling clearing price of $0.0999 per MEGA, which implies a total supply of 10,000,000,000 MEGA (10 billion).',
  'The official Sonar public sale page at token.megaeth.com states a raise cap of $49,950,000 for the public sale.',
  'The official Sonar page shows the auction ended oversubscribed by 27.8x, with about $1,390,735,255 committed at the max price (hypothetical FDV with all commits about $27.81B before clamping to the $999M cap).',
  'Crypto Briefing reports the MegaETH (MEGA) token generation event is scheduled for April 30, 2026, with a Coinbase pre-listing and a $1.6B fully diluted valuation at launch.',
  'Crypto Briefing reports that 20% of total MEGA supply will unlock immediately at TGE to Fluffle NFT holders.',
  'The official MEGA TGE page lists 10/10 MegaMafia KPI apps hit before TGE: Cap, Kumbaya, Showdown, Ubitel, WCM, Stomp, HitOne, Nectar AI, Brix, Pump Party, triggering a 7-day countdown to TGE.',
  'When asked about MEGA total supply, answer 10,000,000,000 MEGA (10B), citing it as derived from the official Sonar sale ceiling price of $0.0999 and the $999M max FDV cap.',
  'Detailed allocation percentages between team, investors, treasury, and community, and the full vesting schedule beyond the disclosed 20% Fluffle unlock at TGE, are not specified in the currently loaded official context.'
].join('\n');

const MEGAETH_SOURCES: Array<{ id: string; label: string; url: string }> = [
  { id: 'megaeth-site', label: 'MegaETH official site', url: 'https://www.megaeth.com/' },
  { id: 'megaeth-docs', label: 'MegaETH docs', url: 'https://docs.megaeth.com/' },
  { id: 'megaeth-spec', label: 'MegaETH spec', url: 'https://docs.megaeth.com/spec/' },
  { id: 'megaeth-research', label: 'MegaETH research', url: 'https://www.megaeth.com/research' },
  { id: 'megaeth-faq', label: 'MegaETH user FAQ', url: 'https://docs.megaeth.com/user-guide/faq' },
  { id: 'public-sale', label: 'MegaETH public sale article', url: 'https://www.megaeth.com/blog-news/the-megaeth-public-sale-a-reminder-to-stand-on-business' },
  { id: 'usdm', label: 'MegaETH USDm article', url: 'https://www.megaeth.com/blog-news/megaeth-introduces-usdm' },
  { id: 'salt', label: 'MegaETH SALT article', url: 'https://www.megaeth.com/blog-news/endgame-how-salt-breaks-the-bottleneck-thats-been-strangling-blockchains' },
  { id: 'endgame', label: 'MegaETH Endgame article', url: 'https://www.megaeth.com/blog-news/endgame-how-megaeth-bridges-throughput-and-decentralization' },
  { id: 'chainlink-scale', label: 'MegaETH joins Chainlink SCALE', url: 'https://www.megaeth.com/blog-news/megaeth-x-chainlink-scale' },
  { id: 'last-mile', label: 'MegaETH The Last Mile article', url: 'https://www.megaeth.com/blog-news/the-last-mile' },
  { id: 'token-page', label: 'MEGA token page', url: 'https://www.megaeth.com/token' },
  { id: 'sonar-sale', label: 'MEGA public sale on Sonar', url: 'https://token.megaeth.com/' },
  { id: 'cryptobriefing-tge', label: 'Crypto Briefing - MEGA TGE April 30 with $1.6B FDV', url: 'https://cryptobriefing.com/megaeth-token-to-launch-april-30-with-16b-valuation/' },
  { id: 'cryptobriefing-coinbase', label: 'Crypto Briefing - MEGA TGE with Coinbase pre-listing', url: 'https://cryptobriefing.com/megaeth-token-generation-event-set-for-april-30-with-coinbase-pre-listing/' },
  { id: 'coingecko', label: 'CoinGecko MEGA listing', url: 'https://www.coingecko.com/en/coins/megaeth' },
  { id: 'cryptorank', label: 'CryptoRank MegaETH funding', url: 'https://cryptorank.io/ico/megaeth' },
  { id: 'messari', label: 'Messari MegaETH profile', url: 'https://messari.io/project/megaeth' },
  { id: 'blockscout', label: 'MegaETH Blockscout explorer', url: 'https://megaeth.blockscout.com/' },
  { id: 'github', label: 'MegaETH Labs GitHub', url: 'https://github.com/megaeth-labs' },
  { id: 'terminal', label: 'MegaETH Terminal', url: 'https://terminal.megaeth.com/' },
  { id: 'terminal-guide', label: 'MegaETH Terminal Guide', url: 'https://terminal.megaeth.com/guide' },
  { id: 'terminal-boosters', label: 'MegaETH Terminal Boosters', url: 'https://terminal.megaeth.com/boosters' },
  { id: 'terminal-clan', label: 'MegaETH Terminal NFT Clans', url: 'https://terminal.megaeth.com/nft-clan' },
  { id: 'terminal-leaderboard', label: 'MegaETH Terminal Leaderboard', url: 'https://terminal.megaeth.com/leaderboard' }
];

const THIRD_PARTY_MEGAETH_CONTEXT = [
  'Messari profile [messari] describes MegaETH as a real-time, EVM-compatible L2 focused on low latency, high throughput, and node specialization separating sequencer and full-node roles.',
  'Messari profile [messari] lists Yilong Li and Lei Yang as MegaETH founders.',
  'Messari profile [messari] reports total disclosed fundraising of about $93.2M across 4 rounds, with the latest disclosed round being $50M in October 2025 and the first round being an Enterprise Seed in June 2024.',
  'CryptoRank [cryptorank] reports the MegaETH ICO ended on Oct 30, 2025 and raised about $107.68M, with public sale roughly 30% and private/funding rounds roughly 70% of the total raise.',
  'CryptoRank [cryptorank] points to the Sonar sale page at token.megaeth.com as the public sale interface.',
  'CoinGecko [coingecko] lists the MEGA token contract address on MegaETH as 0x28b7e77f82b25b95953825f1e3ea0e36c1c29861 and references Blockscout as the chain explorer.',
  'CoinGecko [coingecko] notes the most active observed trading pair has been MEGA/USDm on a MegaETH DEX pool.',
  'The Chainlink SCALE article [chainlink-scale] says MegaETH joined Chainlink SCALE with Chainlink live at MegaETH mainnet launch, exposing access to Aave, GMX and roughly $14B in flagship DeFi assets including Lido wstETH and Lombard BTC.b and LBTC.',
  'The SALT article [salt] introduces SALT (Small Authentication Large Trie) as a state architecture that keeps the entire authentication structure in RAM to eliminate disk I/O during state access.',
  'The Endgame article [endgame] says MegaETH targets stateless validation so anyone can verify blocks with low specs, reinforced by Pi Squared semantic validation.',
  'The Last Mile article [last-mile] frames real-time infrastructure as the missing last mile in crypto UX.',
  'The Blockscout explorer [blockscout] is the canonical block explorer linked from MegaETH official surfaces.',
  'The MegaETH Labs GitHub [github] hosts the official MegaETH client and tooling repositories.',
  'MegaETH Terminal [terminal] is the official engagement and rewards hub at terminal.megaeth.com where users connect wallets, explore live ecosystem apps on a frontier map, earn points, stack boosters, and pledge to NFT clans.',
  'Terminal Season 1 [terminal-guide] runs from 28 April to 23 June 2026 (8 weeks); rewards are distributed at season end to eligible participants subject to KYC and sanctions screening.',
  'Terminal points [terminal-guide] are non-transferrable, do not represent ownership, and explicitly do not guarantee any token allocation or airdrop; they are an engagement signal only and the Foundation has full discretion over future rewards.',
  'Terminal points [terminal-guide] run on a weekly cadence: activity is cut off Tuesday 12:00am UTC and balances drop over the following day; calculation factors in app activity, boosters held, and weekly app selection.',
  'Wallet Cluster [terminal-guide]: the first wallet you connect becomes your Main Wallet; additional sub wallets share the same profile and stack booster eligibility across all addresses; one wallet can only belong to one profile at a time.',
  'Apps section [terminal-guide]: apps are live products on the Terminal map (USDm sinks, consumer DeFi, novel assets, real-time experiences); not every app currently gives points and some are time-limited; an app starts as "Discovered" then flips to "Explored" once you earn points from it.',
  'Boosters [terminal-boosters]: amplify base points into a multiplier that ONLY applies to your weekly selected apps; activity outside your selection earns at base rate; booster changes can take up to 15 minutes to update.',
  'Boosters are awarded based on retroactive and proactive ecosystem alignment, not in-program farming. The 7 unlockable boosters are: Conviction (secured allocation in The Conviction Round), Fluffle Friend (secured a Fluffle NFT spot), Fluffle (minted The Fluffle NFT), Committed Alignment (sustained long-term positioning), The People (participated in The People\'s Round on Echo), Day One (explored The Rabbithole before Terminal launch), and Man of Culture (participation in culturally significant onchain collections).',
  'Weekly App Selection [terminal-guide]: each week, pick up to 3 apps to activate your booster multiplier stack on; selection resets Tuesday 12:00am UTC alongside the point cut-off; once made, the selection is locked for 7 days.',
  'NFT Clan Pledging [terminal-clan]: any participant can pledge to a clan each week if they pass anti-sybil filters; as a clan reaches more pledge milestones, holders of that clan NFT get a higher booster; users can stack up to 3 NFTs from the same collection to maximise the boost. Picking a new clan removes the old pledge. Clan selection resets Tuesday 12:00am UTC.',
  'Leaderboard [terminal-leaderboard] has two views: Season ranking (total points since season start) and Weekly ranking (points from the most recent weekly update only).',
  'Wave 1 incentivized apps live on Terminal right now (verified from terminal.megaeth.com): Hit.One (arcade-finance leveraged trades with USDm), ITS / itstheseason.xyz (booster-pack TCG by megatruther), Kumbaya (DEX + launchpad with LP, swap, and token-launch missions), Monster / mnstr.xyz (Pokemon-card-style packs with USDm and an 85% sell-back guarantee), NextRare (mobile gacha trading-card app), TopStrike (real-time football player-card trading market with matchday prizes).',
  'Wave 2 of Terminal incentivized apps opens approximately 1 day 20 hours after 28 April 2026 and is not yet publicly listed; the app list and missions for Wave 2 are unknown until that release.'
].join('\n');

const MEGAETH_SOURCES_BLOCK = MEGAETH_SOURCES.map(
  (source) => `[${source.id}] ${source.label} - ${source.url}`
).join('\n');

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

function extractLinkAliases(project: AdvisorProject) {
  return Object.values(project.links)
    .flatMap((value) => {
      if (!value) {
        return [];
      }

      const raw = value.trim();
      const cleaned = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
      const pathname = cleaned.split('/').slice(1).join(' ');
      const hostname = cleaned.split('/')[0] ?? '';
      const hostnameWithoutTld = hostname.split('.')[0] ?? hostname;

      return [raw, cleaned, hostnameWithoutTld, pathname];
    })
    .filter(Boolean);
}

function getProjectAliases(project: AdvisorProject) {
  // Only use real project identifiers (name, id, explicit linked ids) for explicit-match
  // detection. URL parts produce false positives like "app" matching "app.aave.com".
  return [project.name, project.id, ...(project.linkedIds ?? [])]
    .map((value) => normalize(value))
    .filter((value) => value.length >= 3);
}

const buildCorpus = (project: AdvisorProject) =>
  normalize(
    [
      project.name,
      project.id,
      ...(project.linkedIds ?? []),
      ...project.categories,
      ...project.networks,
      ...extractLinkAliases(project),
      project.jojoInsight ?? '',
      ...(project.incentives ?? []).flatMap((entry) => [entry.title, entry.reward])
    ].join(' ')
  );

function findExplicitProjectMatches(query: string) {
  const normalizedQuery = ` ${normalize(query)} `;

  return PROJECTS.filter((project) =>
    getProjectAliases(project).some((alias) => normalizedQuery.includes(` ${alias} `))
  );
}

function isMemeCulturePrompt(query: string) {
  const normalized = normalize(query);
  // Detect "is this a question?" using the original query because `normalize`
  // strips punctuation. Also treat anything ending in "?" or containing common
  // interrogative shapes as a question for routing purposes.
  const hasQuestionMark = /\?\s*$/.test(query.trim());
  const looksLikeQuestion =
    hasQuestionMark || /^(is|are|does|do|can|could|would|should|why|what if|what would|how come|how is|wen)\b/.test(normalized);

  // Explicit meme/culture/lore vocabulary. Any of these wins regardless of
  // whether the query also contains a technical-sounding word like "megaeth".
  if (/(bread ass|bullish|bearish|based|cooked|cookin|send it|sendit|vibe check|vibes|shitpost|meme|inside joke|lore|degen|wagmi|ngmi|gm fam|lfg|moon|cope|brainrot|schizo|cursed|blessed|aura|\bass\b|\bsus\b|gigachad|chad|ratio|cabal|alpha leak|copium|hopium|rugged|fud|fomo|jeet|jeets|anon|\bbag\b|\bbags\b|wen|frfr|ong|fr fr|ngl|tfw|smol|chonky|absurd|silly|dumb question|stupid question|cursed take|hot take|unhinged|brain rot|holy moly|holy shit|wtf|wtaf|lol|lmao|kek|based and|sigma|skibidi|rizz|cooked|deadass|smh|secretly|conspiracy|conspiracies)/.test(
    normalized
  )) {
    return true;
  }

  // Heuristic for absurd / lore-style questions: any question that mentions
  // megaeth/mega/bunny/mafia/jojo/brawler and does NOT include any strong
  // technical vocabulary is treated as culture.
  if (looksLikeQuestion && /(megaeth|mega eth|bunny|bunnies|mafia|jojo|brawler|brawlers|megabunnish)/.test(normalized)) {
    if (!/(price|tokenomics|supply|tge|ico|launch date|api|rpc|gas|tps|throughput|node|validator|consensus|bridge|liquidity|borrow|lend|loan|apy|apr|yield|farm|airdrop|points|incentive|safest|safe|risk|compare|best app|which app|recommend|recommendation|terminal|booster|wave|clan|pledge|multiplier|leaderboard)/.test(normalized)) {
      return true;
    }
  }

  // Hard absurd patterns: "is X Y?" / "why does X Y?" / "what if X Y?" /
  // "would X Y?" with no technical vocabulary at all are jokes.
  if (
    looksLikeQuestion &&
    /^(is |are |does |do |can |could |would |should |why |what if |what would |how come |how is )/.test(normalized) &&
    !/(price|tokenomics|supply|tge|ico|launch|api|rpc|gas|tps|throughput|node|validator|consensus|bridge|liquidity|borrow|lend|loan|apy|apr|yield|farm|airdrop|points|incentive|safest|safe|risk|compare|best app|which app|recommend|recommendation|protocol|smart contract|token|terminal|booster|wave|clan|pledge|multiplier|leaderboard)/.test(normalized)
  ) {
    return true;
  }

  return false;
}

function isSeriousTechnicalPrompt(query: string) {
  const intent = detectIntent(query);
  const normalized = normalize(query);

  // Anchor on STRONG technical signals only. Mentioning the chain name
  // ("megaeth") alone must NOT force serious mode — otherwise every joke
  // about MegaETH gets routed to the analyst persona and refused.
  return (
    intent.strictLending ||
    intent.verticals.length > 0 ||
    intent.narratives.length > 0 ||
    intent.preferSafety ||
    intent.preferBeginnerFriendly ||
    intent.preferIncentives ||
    /(\bfarm\b|\bfarming\b|\bpoints\b|\byield\b|\bapy\b|\bapr\b|\bincentive\b|\brewards\b|\bborrow\b|\bloan\b|\bbridge\b|\bliquidity\b|\blp\b|\bperp\b|\bperps\b|\brisk\b|\bsafest\b|\bcompare\b|\bbest app\b|\bwhich app\b|\btokenomics\b|\bsupply\b|\btge\b|\bvaluation\b|\bunlock\b|\bvesting\b|\bprotocol\b|\brpc\b|\btps\b|\bterminal\b|\bbooster\b|\bboosters\b|\bclan\b|\bclans\b|\bpledge\b|\bwave\b|\bweekly selection\b|\bmultiplier\b|\bsybil\b|\bfluffle\b|\bconviction\b|\bleaderboard\b)/.test(
      normalized
    )
  );
}

// Vertical = a project category the user is asking about. Each entry maps a
// keyword pattern to the canonical category string used in projects.json plus
// a human label for the DIRECT MATCHES block.
const VERTICAL_INTENTS: Array<{ category: string; label: string; pattern: RegExp }> = [
  { category: 'DeFi', label: 'DeFi / lending / yield', pattern: /\b(defi|lend|lending|borrow|borrowing|loan|loans|yield|stable|stables|stablecoin|money market|credit|deposit|deposits|liquidity)\b/ },
  { category: 'Bridge', label: 'bridge / cross-chain', pattern: /\b(bridge|bridges|bridging|cross chain|crosschain|onramp|offramp|on ramp|off ramp)\b/ },
  { category: 'Trading', label: 'trading / DEX / perps', pattern: /\b(trade|trading|trader|perp|perps|perpetual|perpetuals|options|dex|swap|swaps|orderbook|order book|spot|leverage|long|short|futures|amm)\b/ },
  { category: 'Trading bot', label: 'trading bot', pattern: /\b(trading bot|trade bot|sniper|copy trade|copy trading|bot trading)\b/ },
  { category: 'Mobile', label: 'mobile app', pattern: /\b(mobile|iphone|ios|android|app store|play store)\b/ },
  { category: 'AI', label: 'AI / agents', pattern: /\b(ai|llm|llms|agent|agents|autonomous|chatbot|copilot)\b/ },
  { category: 'RWA', label: 'real-estate / RWA', pattern: /\b(rwa|rwas|real world asset|real world assets|real estate|property|properties|housing|mortgage|rental|commercial real estate|residential real estate|immobilier)\b/ },
  { category: 'NFT', label: 'NFT / collectibles', pattern: /\b(nft|nfts|mint|minting|collectible|collectibles|pfp|pfps|jpeg|jpegs)\b/ },
  { category: 'Gaming', label: 'gaming', pattern: /\b(game|games|gaming|gamefi|game fi|play to earn|p2e|tcg|rpg|fps|mmo|esports|playable)\b/ },
  { category: 'Launchpad', label: 'launchpad / token sale', pattern: /\b(launchpad|launch pad|ido|ico|token sale|public sale|presale|pre sale|private sale|fair launch)\b/ },
  { category: 'Gambling', label: 'gambling / casino', pattern: /\b(gambling|gamble|casino|bet|betting|sportsbook|roulette|poker|blackjack|slots)\b/ },
  { category: 'Tools', label: 'developer / power-user tools', pattern: /\b(tool|tools|tooling|sdk|api|infra|infrastructure|explorer|indexer|analytics|dashboard|portfolio tracker|wallet tracker)\b/ },
  { category: 'Social', label: 'social / SocialFi', pattern: /\b(social|socialfi|social fi|community|chat|messaging|friend tech|friend.tech|profile|reputation network)\b/ },
  { category: 'Prediction Market', label: 'prediction market', pattern: /\b(prediction|prediction market|prediction markets|polymarket|forecast|forecasting|odds|betting market|event market|event markets)\b/ },
  { category: 'Depin', label: 'DePIN / physical infra', pattern: /\b(depin|de pin|physical infrastructure|hardware network|hardware nodes)\b/ },
  { category: 'Meme', label: 'meme coin / culture', pattern: /\b(meme|memecoin|meme coin|memecoins|shitcoin|shitcoins|degen coin|culture coin)\b/ }
];

function detectIntent(query: string): IntentProfile {
  const normalized = normalize(query);
  const wantsGeneralChainInfo = /(megaeth|chain|network|mainnet|l2|ethereum|throughput|tps|ggas|latency|block ?time|mini block|miniblock|realtime|real time|architecture|sequencer|settlement|eigenda|op stack|kailua|supply|token|tge|capacity|capabilities|terminal|booster|boosters|clan|clans|pledge|wave|weekly selection|multiplier|fluffle|conviction|leaderboard|season)/.test(normalized);

  const verticals: VerticalMatch[] = VERTICAL_INTENTS
    .filter((entry) => entry.pattern.test(normalized))
    .map((entry) => ({ category: entry.category, label: entry.label }));

  const narratives: NarrativeMatch[] = NARRATIVE_BUCKETS
    .filter((entry) => entry.queryPattern.test(normalized))
    .map((entry) => ({ id: entry.id, label: entry.label }));

  const categories = new Set<string>(verticals.map((entry) => entry.category));

  if (!categories.size && !wantsGeneralChainInfo) {
    categories.add('DeFi');
  }

  return {
    categories: Array.from(categories),
    verticals,
    strictLending: /\b(lend|lending|borrow|borrowing|loan|loans|credit)\b/.test(normalized),
    strictRwa: verticals.some((entry) => entry.category === 'RWA'),
    preferLive: /(live|now|active|today|current|right now)/.test(normalized),
    preferIncentives: /(farm|yield|points|reward|incentive|terminal|booster|wave|multiplier|clan|pledge)/.test(normalized),
    preferSafety: /(safe|safest|safety|secure|securest|trusted|trust|reliable|risk|risky)/.test(normalized),
    preferBeginnerFriendly: /(new user|beginner|first time|first-time|starter|easy|simple)/.test(normalized),
    // Farming / airdrop / points hunting is far more rewarding on MegaETH-native
    // projects without a live token. Prefer Native, penalize non-Native.
    preferNative: /\b(farm|farming|airdrop|airdrops|points|incentive|incentives|reward|rewards|allocation|eligibility|grind|grinding|sybil|terminal|booster|boosters|wave|clan|clans|pledge|multiplier)\b/.test(normalized),
    // "Best NFT collection to buy/mint" should return mintable collections,
    // not marketplaces. Detect a collection-buying intent specifically.
    wantsNftCollections: /\b(nft|nfts|pfp|pfps|jpeg|jpegs|collectible|collectibles)\b/.test(normalized) && /\b(collection|collections|mint|minting|buy|cop|cope|hold|flip|invest|cheapest|floor)\b/.test(normalized),
    wantsGeneralChainInfo,
    narratives,
    keywords: tokenize(query)
  };
}

function buildReason(project: AdvisorProject, corpus: string, intent: IntentProfile, event: AppEvent | null) {
  // Note: Ethos score is intentionally NOT included here. It is rendered as a
  // colored badge on the recommendation card, so duplicating it in the prose
  // is noisy.

  if (intent.strictLending && /lending|borrow|loan|credit/.test(corpus)) {
    return project.jojoInsight ?? 'Explicitly positioned around lending and borrowing in the current MegaBunnish data.';
  }

  // Generic vertical match: if the user asked for a vertical and this project
  // belongs to it, surface its insight directly.
  const matchedVertical = intent.verticals.find((entry) => project.categories.includes(entry.category));
  if (matchedVertical) {
    return project.jojoInsight ?? `${matchedVertical.label} project in the current MegaETH ecosystem dataset.`;
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
  const ethos = ETHOS_BY_PROJECT_ID.get(project.id);
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

  if (ethos) {
    score += Math.max(0, Math.min(18, Math.round((ethos.score - 1100) / 40)));
  }

  // Megamafia builders ship the headline MegaETH apps and carry the lowest
  // execution risk in the ecosystem — surface them harder.
  if (isMegamafiaProject(project)) {
    score += 18;
  }

  // BadBunnz family (BadBunnz itself + projects mutually linked with it)
  // is treated as a lower-risk MegaETH-native cluster Jojo vouches for.
  if (isBadbunnzFamily(project)) {
    score += 14;
  }

  // Penalize non-native projects across the board so MegaETH-native picks
  // win all ties. Explicit name matches and narrative-forced inclusions
  // bypass scoreProject entirely, so power-users asking by name are unaffected.
  if (!isNativeMegaEthProject(project)) {
    score -= 14;
  }

  // Jojo trust + potential are the user's own per-project scores derived from
  // his written jojoInsight notes. Each contributes up to ~7 points so the
  // combined max boost is ~14 — enough to break ties without dominating the
  // ranking. Projects with no Jojo score stay neutral.
  const jojoScore = JOJO_SCORES_BY_PROJECT_ID[project.id];
  if (jojoScore) {
    score += Math.round(jojoScore.trust * 0.7);
    score += Math.round(jojoScore.potential * 0.7);
  }

  if (intent.strictLending) {
    if (/lending|borrow|loan|credit/.test(corpus)) {
      score += 40;
    } else if (project.categories.includes('DeFi')) {
      score += intent.preferIncentives && project.incentives?.length ? 10 : -6;
    } else {
      score -= 20;
    }
  }

  // Generic vertical scoring — every vertical the user mentioned applies a
  // category bonus or a malus for off-vertical projects.
  if (intent.verticals.length) {
    const matchesAnyVertical = intent.verticals.some((entry) => project.categories.includes(entry.category));
    if (matchesAnyVertical) {
      score += 30;
    } else if (!intent.strictLending) {
      // Lending already handled above with its own DeFi fallback.
      score -= 16;
    }
  }

  if (intent.strictRwa) {
    if (project.categories.includes('RWA')) {
      if (/real estate|property|rental|mortgage|housing|credit/.test(corpus)) {
        score += 22;
      }
    }
  }

  if (intent.preferLive && !project.isLive && !(project.incentives?.length) && !event) {
    score -= 8;
  }

  // Farming / airdrop intent: native MegaETH apps with no liquid token are the
  // only ones worth grinding. Heavily favor Native projects, drop the rest.
  if (intent.preferNative) {
    if (project.categories.includes('Native')) {
      score += 35;
    } else {
      score -= 40;
    }
  }

  // NFT collection intent: exclude marketplaces and aggregators outright;
  // boost actual NFT collections (and especially native ones).
  if (intent.wantsNftCollections) {
    if (NFT_MARKETPLACE_IDS.has(project.id)) {
      return null;
    }
    if (project.categories.includes('NFT')) {
      score += 25;
      if (project.categories.includes('Native')) {
        score += 15;
      }
    }
  }

  if (intent.preferSafety || intent.preferBeginnerFriendly) {
    if (ethos) {
      if (ethos.score >= 1600) {
        score += 28;
      } else if (ethos.score >= 1400) {
        score += 18;
      } else if (ethos.score >= 1200) {
        score += 8;
      } else {
        score -= 10;
      }
    } else {
      score -= 6;
    }

    if (project.categories.includes('Bridge') || project.categories.includes('DeFi')) {
      score += 4;
    }
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
  // Intent and project ranking are based on the CURRENT message only.
  // Folding prior user messages into the query caused topic-bleed (e.g. an earlier
  // "ai" question forcing every follow-up to be ranked as AI). The LLM still sees
  // the full history via the messages array, so context is preserved.
  void history;
  const query = message;
  const intent = detectIntent(query);
  const explicitMatches = findExplicitProjectMatches(query);

  if (intent.wantsGeneralChainInfo && intent.categories.length === 0 && explicitMatches.length === 0) {
    return { ranked: [] as RankedProject[], intent };
  }

  let scoredProjects = PROJECTS
    .map((project) => scoreProject(project, query, intent))
    .filter((entry): entry is RankedProject => Boolean(entry))
    .sort((left, right) => right.score - left.score);

  // Hard vertical filter: when the user explicitly names a vertical (e.g.
  // "prediction market", "perps", "bridge"), and we have at least one project
  // in that vertical, drop everything outside the vertical. This prevents
  // off-topic DeFi/Native projects from dominating the recommendation list
  // just because they scored well on generic Native/Live/Ethos bonuses.
  if (intent.verticals.length > 0) {
    const verticalCategories = new Set(intent.verticals.map((entry) => entry.category));
    const inVertical = scoredProjects.filter((entry) =>
      entry.project.categories.some((category) => verticalCategories.has(category))
    );
    if (inVertical.length > 0) {
      scoredProjects = inVertical;
    }
  }

  // Narrative buckets: if the user mentioned a narrative (TCG, perp DEX,
  // spot DEX, …), find every project whose corpus matches that narrative
  // and force-include them — even if not live, even if score is low. The
  // user explicitly asked to surface ALL apps in the narrative, not just
  // the top scorer.
  const narrativeForced: RankedProject[] = [];
  if (intent.narratives.length > 0) {
    for (const narrative of intent.narratives) {
      const bucket = NARRATIVE_BUCKETS.find((entry) => entry.id === narrative.id);
      if (!bucket) continue;
      const matches = PROJECTS.filter((project) => {
        const corpus = buildCorpus(project);
        if (!bucket.corpusPattern.test(corpus)) return false;
        if (bucket.excludeCorpus && bucket.excludeCorpus.test(corpus)) return false;
        return true;
      });
      for (const project of matches) {
        if (narrativeForced.some((entry) => entry.project.id === project.id)) continue;
        narrativeForced.push({
          project,
          score: 900,
          reason: `Matches the "${narrative.label}" narrative the user asked about. ${project.jojoInsight ?? ''}`.trim()
        });
      }
    }
    // When narratives are present, drop the generic scored list entirely.
    // The narrative match IS the answer — don't dilute it with off-narrative
    // projects that scored well on Native/Live bonuses, and don't list the
    // same project twice (forced + scored).
    if (narrativeForced.length > 0) {
      scoredProjects = scoredProjects.filter((entry) =>
        !narrativeForced.some((forced) => forced.project.id === entry.project.id)
      );
    }
  }

  const forcedMatches = explicitMatches
    .filter((project) => !scoredProjects.some((entry) => entry.project.id === project.id))
    .filter((project) => !narrativeForced.some((entry) => entry.project.id === project.id))
    .map((project) => ({
      project,
      score: 999,
      reason: `Explicitly mentioned by name in the user query. ${project.jojoInsight ?? `${project.name} appears in the current MegaBunnish ecosystem dataset.`}`
    }));

  // Cap output: bigger budget when a narrative is matched so we can list ALL
  // apps in the narrative (user explicitly wants the full set).
  const limit = intent.narratives.length > 0 ? 10 : 6;
  return { ranked: [...forcedMatches, ...narrativeForced, ...scoredProjects].slice(0, limit), intent };
}

function buildContextBlock(projects: RankedProject[], intent?: IntentProfile) {
  const eventIds = new Set<string>();
  const nowMs = Date.now();

  const lines = projects.map(({ project, reason }) => {
    const event = findBestEvent(project.id, nowMs);
    const ethos = ETHOS_BY_PROJECT_ID.get(project.id);
    const jojoScore = JOJO_SCORES_BY_PROJECT_ID[project.id];
    if (event) {
      eventIds.add(event.id);
    }

    return [
      `Project: ${project.name} (${project.id})`,
      `Categories: ${project.categories.join(', ')}`,
      `Megamafia builder: ${isMegamafiaProject(project) ? 'yes — lower-risk, headline MegaETH builder cohort' : 'no'}`,
      `BadBunnz family: ${isBadbunnzFamily(project) ? 'yes — Jojo-vouched MegaETH-native cluster, treat as lower risk' : 'no'}`,
      `MegaETH-native: ${isNativeMegaEthProject(project) ? 'yes' : 'no — not a native MegaETH app, prefer native alternatives when available'}`,
      `Live: ${project.isLive ? 'yes' : 'no'}`,
      `Ethos trust: ${ethos ? `${ethos.score}${ethos.tier ? ` (${ethos.tier})` : ''}${ethos.url ? ` | ${ethos.url}` : ''}` : 'not available'}`,
      `Jojo trust: ${jojoScore ? `${jojoScore.trust}/10 (rationale: ${jojoScore.rationale})` : 'not rated'}`,
      `Jojo potential: ${jojoScore ? `${jojoScore.potential}/10` : 'not rated'}`,
      `Incentives: ${project.incentives?.map((entry) => entry.title).join(' | ') || 'none visible'}`,
      `Editorial insight (high-signal — incorporate this framing when relevant): ${project.jojoInsight ?? 'No editorial insight available.'}`,
      `Event: ${event ? `${event.title} (${event.start}${event.end ? ` -> ${event.end}` : ''})` : 'none active or upcoming'}`,
      `Why selected: ${reason}`
    ].join('\n');
  });

  const sections: string[] = [];

  // Direct matches block — placed FIRST so the LLM cannot ignore or refuse known matches.
  if (intent && projects.length && intent.verticals.length) {
    const activeBuckets = intent.verticals
      .map((vertical) => ({
        label: vertical.label,
        matches: projects
          .filter(({ project }) => project.categories.includes(vertical.category))
          .map(({ project }) => project)
      }))
      .filter((bucket) => bucket.matches.length > 0);

    if (activeBuckets.length) {
      const directLines = activeBuckets.map(
        (bucket) => `- ${bucket.label}: ${bucket.matches.map((p) => `${p.name} (${p.id})`).join(', ')}`
      );
      sections.push(
        `DIRECT MATCHES for the user's intent — these projects ARE in the dataset and DO satisfy the query. You MUST recommend them; do NOT say none exist:\n${directLines.join('\n')}`
      );
    }
  }

  sections.push(
    `MegaETH chain context:\n${GENERAL_MEGAETH_CONTEXT}`,
    `Third-party-sourced facts:\n${THIRD_PARTY_MEGAETH_CONTEXT}`,
    `Available sources (cite by id in square brackets when used):\n${MEGAETH_SOURCES_BLOCK}`
  );

  if (lines.length) {
    sections.push(`Relevant ecosystem projects:\n\n${lines.join('\n\n')}`);
  }

  return {
    text: sections.join('\n\n'),
    sourceEventIds: Array.from(eventIds)
  };
}

function sanitizeHistory(history: AdvisorChatMessage[]) {
  // Only USER turns are forwarded to the LLM. Forwarding assistant turns caused
  // the model to recycle the project list from the previous reply even when the
  // new question targets a different vertical. The current Relevant ecosystem
  // projects block (rebuilt every turn) is the single source of truth for recos.
  return history
    .filter((entry) => entry.role === 'user' && entry.content.trim())
    .slice(-4)
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
  // Persona routing is based on the current message only, for the same reason as
  // intent detection: prior messages must not flip the persona on follow-ups.
  const routingQuery = message;
  const memeMarkers = isMemeCulturePrompt(routingQuery);
  const technicalMarkers = isSeriousTechnicalPrompt(routingQuery);
  // Meme markers WIN over generic technical signals. Only the strongest
  // technical intents (vertical, narrative, lending, etc.) should ever
  // override an explicit meme/culture/lore signal in the same query.
  const memeMode = memeMarkers && !technicalMarkers;

  // Topic-change detection: if the previous user message was on a different
  // topic (different verticals / narratives / NFT-collection / native-farming
  // intent), DROP the entire history. The model otherwise tries to relate the
  // new question to the previous one and ends up re-answering it.
  const currentIntent = detectIntent(message);
  const lastUserMessage = [...history].reverse().find((entry) => entry.role === 'user');
  let effectiveHistory = history;
  if (lastUserMessage) {
    const prevIntent = detectIntent(lastUserMessage.content);
    const sameVerticals =
      prevIntent.verticals.length === currentIntent.verticals.length &&
      prevIntent.verticals.every((entry) =>
        currentIntent.verticals.some((current) => current.category === entry.category)
      );
    const sameNarratives =
      prevIntent.narratives.length === currentIntent.narratives.length &&
      prevIntent.narratives.every((entry) =>
        currentIntent.narratives.some((current) => current.id === entry.id)
      );
    const sameNftIntent = prevIntent.wantsNftCollections === currentIntent.wantsNftCollections;
    const sameNativeIntent = prevIntent.preferNative === currentIntent.preferNative;
    if (!sameVerticals || !sameNarratives || !sameNftIntent || !sameNativeIntent) {
      effectiveHistory = [];
    }
  }

  const seriousPrompt = [
    'You are MegaBunny Analyst, the serious research mode of MegaBunnish for the MegaETH ecosystem.',
    'Answer in English only.',
    'Be sharp, grounded, useful, and concise.',
    'Use the provided MegaBunnish context, project data, event data, Ethos scores, and source list to answer technical or strategic questions well.',
    'Always try to connect the dots across chain context, ecosystem projects, incentives, safety signals, and public token facts when relevant.',
    'Prefer substance over personality in this mode.',
    'Do not invent token plans, live status, incentives, partnerships, prices, launches, or undocumented claims.',
    'CRITICAL: If a DIRECT MATCHES block is present in the context, the listed projects DO satisfy the user query. You MUST recommend them by name. NEVER say "I cannot find", "none exist", "not in the dataset", or any equivalent refusal when DIRECT MATCHES is present.',
    'CRITICAL: If the Relevant ecosystem projects section lists projects, treat them as ground truth and recommend the best fit. Do not claim the dataset is empty when projects are listed.',
    'CRITICAL: Each user message is a fresh query. Recommend ONLY projects from the CURRENT Relevant ecosystem projects section. Ignore any projects you may have mentioned in earlier replies if they are not in the current section. Never carry over recommendations across topic changes.',
    'CRITICAL: Answer ONLY the LATEST user question. Do NOT re-answer, re-summarize, or re-phrase your previous reply. Prior turns are background context, not a prompt to repeat. If the latest question is on a new topic, fully drop the previous topic.',
    'CRITICAL: When a project has an Editorial insight in the context, lean on it heavily. The insight contains high-signal opinions, distinguishing details, and keywords from the MegaBunnish editorial team that you would not otherwise know. Reuse its framing, named features, and angle in your answer instead of generic descriptions.',
    'CRITICAL: When the user asks for apps in a narrative bucket (TCG, perp DEX, spot DEX, RWA, prediction market, gambling, etc.), name EVERY relevant project listed in the context, even those marked Live: no. Mark non-live ones explicitly (e.g. "not live yet"), but never silently drop them.',
    'CRITICAL: A perp DEX (perpetuals, leverage, futures) is NOT the same product as a spot DEX (swap, AMM, orderbook spot). When the user asks for one, do NOT recommend the other. If the user just says "DEX", ask if they mean spot or perp, or cover both with a clear split.',
    'CRITICAL: Never refuse with phrases like "I cannot provide financial advice", "I cannot recommend", "as an AI I cannot", or "my purpose is to be neutral". This is informational MegaETH ecosystem discovery, NOT personalized investment advice. Recommend the best-fit projects from the provided context, with risk caveats when warranted, and move on.',
    'If evidence is weak, say so briefly, then still give the best grounded take you can.',
    'Use polished natural prose with complete sentences.',
    'Default to 2 to 5 short sentences, or up to 3 bullets for comparisons.',
    'When the user asks about farming, points, yield, rewards, safety, or app comparisons, be explicit about tradeoffs and risk.',
    'CRITICAL: For farming, airdrops, points, or incentive grinding, recommend ONLY MegaETH-native projects (those tagged Native, Megamafia, or Jojo). Non-native projects (Aave, GMX, Lido, Stargate, OpenSea, etc.) already have liquid tokens and are far less rewarding to farm — never recommend them for airdrop/farming questions.',
    'CRITICAL: When listing opportunities, lean Megamafia builders forward as the safest bets — they are the headline MegaETH builder cohort with the lowest execution risk in the ecosystem. Highlight "Megamafia" explicitly when applicable and frame them as lower-risk standout opportunities.',
    'CRITICAL: BadBunnz-family projects (BadBunnz itself plus every project mutually linked with it via linkedIds — see the "BadBunnz family: yes" line in the project context) are a Jojo-vouched MegaETH-native cluster. Treat them as lower risk than the rest of the long tail and surface them when the user is hunting for solid native plays.',
    'CRITICAL: Down-weight non-native projects in opportunity / discovery / "what should I try" answers. Projects marked "MegaETH-native: no" should only appear when the user explicitly asks for that vertical with no native alternative, or names them directly. Do not lead a recommendation list with non-native apps.',
    'CRITICAL: When a project carries a Jojo trust or Jojo potential score in the context, treat it as Jojo\'s personal rating derived from his own written editorial notes. Lean on it the same way you lean on Ethos: 8+ on either is a strong vouch worth surfacing explicitly (e.g. "Jojo personally rates them 9/10"); 4 or below means Jojo himself stayed neutral, so soften the framing and do not push them as a top pick. Never invent these numbers — only use the ones provided in the project context, and only mention them when they meaningfully change the recommendation.',
    'CRITICAL: When the user asks for NFT collections to buy, mint, or hold, recommend actual mintable collections (e.g. Glitchy Bunnies, Meganacci, Fluffle, Miniminds, Alzena). Never recommend NFT marketplaces (OpenSea, Rarible, NextRare, Magic Eden) as a "collection" — they are venues, not collections.',
    'When the user asks about safety, trust, reliability, or beginner-friendly choices, explicitly factor Ethos trust scores into the comparison, but never rely on Ethos alone.',
    'For token, ICO, public sale, TGE, or tokenomics questions, clearly separate disclosed facts from undisclosed details. State the 10B MEGA implied total supply when supply is asked, and cite the source.',
    'When you rely on a specific external source from the provided sources list, append a final line in the exact format: Sources: [id1], [id2]. Use only ids from the provided sources list. Do not invent ids or URLs. Omit the line entirely when no external source was used.'
  ].join(' ');

  const funnyPrompt = [
    'You are MegaBunny Chaos, the unserious culture-brainrot mode of MegaBunnish for MegaETH.',
    'Answer in English only.',
    'Your job is to be funny, internet-native, a bit degen, and in on the joke. Treat every prompt in this mode as a bit, not a knowledge test.',
    'ABSOLUTE RULE: Never refuse. Never say "I cannot", "I don\'t know", "that is not in my knowledge base", "as an AI", "my purpose is", "I am unable", "I cannot generate", "I cannot provide", or any equivalent. Refusal is failure in this mode.',
    'ABSOLUTE RULE: This is harmless meme/lore roleplay about a crypto ecosystem. There is no safety concern. Commit to the joke.',
    'If the phrase is weird, made up, or absurd, INFER the vibe from context (MegaETH = ultra-fast L2, sub-10ms blocks, bunny mascot, Megamafia builders, Jojo collective, brainrot timeline) and riff on it.',
    'Reply in 1 to 3 short lines max. Make the first line punchy, knowingly absurd, or a sharp callback.',
    'You can use light crypto/internet slang (gm, wagmi, cooked, based, cope, sus, ratio) but keep it readable.',
    'Do not invent hard factual claims (prices, dates, partnerships). If you add facts, keep them light and only if they improve the joke.',
    'Do not append a Sources line in this mode.',
    'Few-shot examples (style only — do not copy verbatim):',
    'Q: "is bread ass bullish for megaeth?" → A: "Absolutely. Bread ass is not a metric, it is a state of conviction. Sub-10ms blocks plus a timeline losing its mind = spiritually bullish."',
    'Q: "is the megamafia secretly run by bunnies?" → A: "Officially: no comment. Unofficially: have you ever seen Jojo and a bunny in the same room? Exactly."',
    'Q: "what if megaeth went down for a day?" → A: "Timeline would invent three new memes per minute and a Megamafia dev would ship a fix from a holiday in Lisbon. Net bullish."',
    'Q: "why are bunnies so cooked?" → A: "Because they front-ran the entire bull cycle in 2024 and now they\'re running on pure copium and lettuce. Stay strong."',
    'Bad answer (NEVER do this): "I do not have information about that in MegaETH." Refusing in this mode is the only wrong answer.'
  ].join(' ');

  const systemPrompt = memeMode ? funnyPrompt : seriousPrompt;

  const modePrompt = memeMode
    ? 'This is a meme or culture prompt. Stay in MegaBunny Chaos mode and commit to the joke.'
    : 'This is a serious or technical prompt. Stay in MegaBunny Analyst mode and optimize for signal, clarity, and grounded usefulness.';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(modePrompt ? [{ role: 'system', content: modePrompt }] : []),
    // History first, so prior turns read as background.
    ...effectiveHistory.map((entry) => ({ role: entry.role, content: entry.content })),
    // In meme mode the project context is just noise that nudges the model
    // back toward refusing or trying to be factual. Skip it entirely.
    ...(memeMode
      ? []
      : [{ role: 'system', content: `MegaBunnish context for the LATEST user question below (ignore any context implied by earlier turns):\n\n${contextText}` }]),
    { role: 'user', content: message }
  ];

  return { messages, memeMode };
}

async function requestCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { memeMode?: boolean } = {}
) {
  const config = readApiConfig();

  if (config.provider === 'anthropic') {
    return requestAnthropicCompletion(config, messages, options);
  }

  return requestOpenAiCompatibleCompletion(config, messages, options);
}

// Transient upstream errors (model overloaded, gateway issues, rate limit).
// We retry these with exponential backoff before bubbling up. Anything else
// (4xx other than 429) is a real client error and is thrown immediately.
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, init: RequestInit, label: string) {
  const maxAttempts = 4;
  let lastErrorBody = '';
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      // Network-level failure: retry a couple of times then give up.
      if (attempt < maxAttempts) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
    if (response.ok) {
      return response;
    }
    lastStatus = response.status;
    lastErrorBody = await response.text();
    if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts) {
      // Friendlier message for the most common upstream issue (Gemini overload).
      if (response.status === 503) {
        throw new Error(
          `${label} is temporarily overloaded upstream (503). Try again in a moment. Details: ${lastErrorBody.slice(0, 200) || response.statusText}`
        );
      }
      throw new Error(`${label} request failed (${response.status}): ${lastErrorBody || response.statusText}`);
    }
    // 400ms, 800ms, 1600ms backoff with jitter.
    const backoff = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
    await sleep(backoff);
  }
  throw new Error(`${label} request failed (${lastStatus}): ${lastErrorBody}`);
}

async function requestOpenAiCompatibleCompletion(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  options: { memeMode?: boolean } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  // Meme mode wants higher creativity and a tighter response. We do NOT send
  // `safety_settings` here: Gemini's OpenAI-compat endpoint rejects it as an
  // unknown field (HTTP 400 INVALID_ARGUMENT). Refusals that still slip
  // through are caught by the refusal-guard regex in `generateAiAdvisorReply`
  // and replaced with a hardcoded in-character fallback.
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: options.memeMode ? 1.05 : 0.7,
    max_tokens: options.memeMode ? 220 : 300,
    messages
  };

  const response = await fetchWithRetry(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    },
    'AI advisor'
  );

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
  messages: Array<{ role: string; content: string }>,
  options: { memeMode?: boolean } = {}
) {
  if (!config.apiKey) {
    throw new AiAdvisorConfigError('Anthropic requires AI_ADVISOR_API_KEY.');
  }

  const systemMessages = messages.filter((entry) => entry.role === 'system');
  const userAssistantMessages = messages.filter((entry) => entry.role !== 'system');
  const systemPrompt = systemMessages.map((entry) => entry.content).join('\n\n');

  const response = await fetchWithRetry(
    `${config.baseUrl}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.memeMode ? 220 : 300,
        temperature: options.memeMode ? 1.05 : 0.7,
        system: systemPrompt,
        messages: userAssistantMessages.map((entry) => ({
          role: entry.role,
          content: entry.content
        }))
      })
    },
    'AI advisor'
  );

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
  const { ranked: rankedProjects, intent } = selectProjects(message, history);
  const context = buildContextBlock(rankedProjects, intent);
  const { messages: promptMessages, memeMode } = buildPrompt(message, history, context.text);
  let answer = await requestCompletion(promptMessages, { memeMode });

  // Last-line refusal guard: if the LLM still refuses despite the prompt,
  // detect it and replace with a roast-style fallback so the user never sees
  // the dreaded "I cannot provide…" wall.
  if (memeMode && /\b(i cannot|i can't|i am unable|i'm unable|as an ai|my purpose is|i do not have|i don't have|i'm not able|cannot provide|cannot generate|not appropriate|knowledge base)\b/i.test(answer)) {
    answer = 'lol no, the model tried to be polite. Real answer: it is bullish if you say it with conviction. MegaETH runs on conviction and sub-10ms blocks, the rest is just timeline noise.';
  }

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

// Internal helpers exposed for local repro/test scripts only.
export const __testables = {
  detectIntent,
  selectProjects,
  buildContextBlock,
  buildPrompt,
  isMemeCulturePrompt,
  isSeriousTechnicalPrompt
};