var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { randomUUID } from 'node:crypto';
import { APP_EVENTS } from '../src/data/appEvents';
import { ETHOS_PROFILE_OVERRIDES } from '../src/data/ethosManualProfiles';
import rawProjects from '../src/data/projects.json';
// Projects in the dataset that are NFT marketplaces or aggregators rather
// than mintable NFT collections. When the user asks for collections to buy or
// mint, these should not be surfaced as collections.
var NFT_MARKETPLACE_IDS = new Set(['opensea', 'rarible', 'nextrare', 'magiceden']);
var PROJECTS = rawProjects;
var ETHOS_BY_PROJECT_ID = new Map(ETHOS_PROFILE_OVERRIDES.filter(function (entry) { return entry.projectId; }).map(function (entry) { return [
    entry.projectId,
    {
        score: entry.score,
        tier: entry.tier,
        url: entry.url
    }
]; }));
var DEFAULT_MODEL = 'gpt-4.1-mini';
var DEFAULT_BASE_URL = 'https://api.openai.com/v1';
var DEFAULT_SUGGESTED_PROMPTS = [
    'Which lending protocol looks strongest on MegaETH right now?',
    'Compare the safest DeFi options for a new user.',
    'Which bridge should I use to move into MegaETH?',
    'Which mobile-first app should I try first?',
    'How does MegaETH differ from a typical Ethereum L2?'
];
var GENERAL_MEGAETH_CONTEXT = [
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
var MEGAETH_SOURCES = [
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
    { id: 'github', label: 'MegaETH Labs GitHub', url: 'https://github.com/megaeth-labs' }
];
var THIRD_PARTY_MEGAETH_CONTEXT = [
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
    'The MegaETH Labs GitHub [github] hosts the official MegaETH client and tooling repositories.'
].join('\n');
var MEGAETH_SOURCES_BLOCK = MEGAETH_SOURCES.map(function (source) { return "[".concat(source.id, "] ").concat(source.label, " - ").concat(source.url); }).join('\n');
var AiAdvisorConfigError = /** @class */ (function (_super) {
    __extends(AiAdvisorConfigError, _super);
    function AiAdvisorConfigError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AiAdvisorConfigError;
}(Error));
export { AiAdvisorConfigError };
function isLocalBaseUrl(baseUrl) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl);
}
function isAnthropicBaseUrl(baseUrl) {
    return /anthropic\.com/i.test(baseUrl);
}
var normalize = function (value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};
var tokenize = function (value) { return normalize(value).split(/\s+/).filter(Boolean); };
function extractLinkAliases(project) {
    return Object.values(project.links)
        .flatMap(function (value) {
        var _a, _b;
        if (!value) {
            return [];
        }
        var raw = value.trim();
        var cleaned = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
        var pathname = cleaned.split('/').slice(1).join(' ');
        var hostname = (_a = cleaned.split('/')[0]) !== null && _a !== void 0 ? _a : '';
        var hostnameWithoutTld = (_b = hostname.split('.')[0]) !== null && _b !== void 0 ? _b : hostname;
        return [raw, cleaned, hostnameWithoutTld, pathname];
    })
        .filter(Boolean);
}
function getProjectAliases(project) {
    var _a;
    // Only use real project identifiers (name, id, explicit linked ids) for explicit-match
    // detection. URL parts produce false positives like "app" matching "app.aave.com".
    return __spreadArray([project.name, project.id], ((_a = project.linkedIds) !== null && _a !== void 0 ? _a : []), true).map(function (value) { return normalize(value); })
        .filter(function (value) { return value.length >= 3; });
}
var buildCorpus = function (project) {
    var _a, _b, _c;
    return normalize(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([
        project.name,
        project.id
    ], ((_a = project.linkedIds) !== null && _a !== void 0 ? _a : []), true), project.categories, true), project.networks, true), extractLinkAliases(project), true), [
        (_b = project.jojoInsight) !== null && _b !== void 0 ? _b : ''
    ], false), ((_c = project.incentives) !== null && _c !== void 0 ? _c : []).flatMap(function (entry) { return [entry.title, entry.reward]; }), true).join(' '));
};
function findExplicitProjectMatches(query) {
    var normalizedQuery = " ".concat(normalize(query), " ");
    return PROJECTS.filter(function (project) {
        return getProjectAliases(project).some(function (alias) { return normalizedQuery.includes(" ".concat(alias, " ")); });
    });
}
function isMemeCulturePrompt(query) {
    var normalized = normalize(query);
    return /(bread ass|bullish|bearish|based|cooked|cookin|send it|sendit|vibe check|vibes|shitpost|meme|inside joke|lore|degen|wagmi|ngmi|gm|lfg|moon|cope|brainrot|schizo|cursed|blessed|aura)/.test(normalized);
}
function isSeriousTechnicalPrompt(query) {
    var intent = detectIntent(query);
    var normalized = normalize(query);
    return (intent.strictLending ||
        intent.verticals.length > 0 ||
        intent.preferSafety ||
        intent.preferBeginnerFriendly ||
        intent.preferIncentives ||
        intent.wantsGeneralChainInfo ||
        /(farm|farming|points|yield|apy|apr|incentive|rewards|borrow|loan|bridge|liquidity|lp|perp|perps|risk|safest|compare|best app|which app|tokenomics|supply|tge|valuation|unlock|vesting)/.test(normalized));
}
// Vertical = a project category the user is asking about. Each entry maps a
// keyword pattern to the canonical category string used in projects.json plus
// a human label for the DIRECT MATCHES block.
var VERTICAL_INTENTS = [
    { category: 'DeFi', label: 'DeFi / lending / yield', pattern: /\b(defi|lend|lending|borrow|borrowing|loan|loans|yield|farm|farming|stable|stables|stablecoin|money market|credit|deposit|deposits|liquidity)\b/ },
    { category: 'Bridge', label: 'bridge / cross-chain', pattern: /\b(bridge|bridges|bridging|cross chain|crosschain|onramp|offramp|on ramp|off ramp)\b/ },
    { category: 'Trading', label: 'trading / perps / DEX', pattern: /\b(trade|trading|trader|perp|perps|perpetual|perpetuals|options|dex|swap|swaps|orderbook|order book|spot|leverage|long|short)\b/ },
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
function detectIntent(query) {
    var normalized = normalize(query);
    var wantsGeneralChainInfo = /(megaeth|chain|network|mainnet|l2|ethereum|throughput|tps|ggas|latency|block ?time|mini block|miniblock|realtime|real time|architecture|sequencer|settlement|eigenda|op stack|kailua|supply|token|tge|capacity|capabilities)/.test(normalized);
    var verticals = VERTICAL_INTENTS
        .filter(function (entry) { return entry.pattern.test(normalized); })
        .map(function (entry) { return ({ category: entry.category, label: entry.label }); });
    var categories = new Set(verticals.map(function (entry) { return entry.category; }));
    if (!categories.size && !wantsGeneralChainInfo) {
        categories.add('DeFi');
    }
    return {
        categories: Array.from(categories),
        verticals: verticals,
        strictLending: /\b(lend|lending|borrow|borrowing|loan|loans|credit)\b/.test(normalized),
        strictRwa: verticals.some(function (entry) { return entry.category === 'RWA'; }),
        preferLive: /(live|now|active|today|current|right now)/.test(normalized),
        preferIncentives: /(farm|yield|points|reward|incentive)/.test(normalized),
        preferSafety: /(safe|safest|safety|secure|securest|trusted|trust|reliable|risk|risky)/.test(normalized),
        preferBeginnerFriendly: /(new user|beginner|first time|first-time|starter|easy|simple)/.test(normalized),
        // Farming / airdrop / points hunting is far more rewarding on MegaETH-native
        // projects without a live token. Prefer Native, penalize non-Native.
        preferNative: /\b(farm|farming|airdrop|airdrops|points|incentive|incentives|reward|rewards|allocation|eligibility|grind|grinding|sybil)\b/.test(normalized),
        // "Best NFT collection to buy/mint" should return mintable collections,
        // not marketplaces. Detect a collection-buying intent specifically.
        wantsNftCollections: /\b(nft|nfts|pfp|pfps|jpeg|jpegs|collectible|collectibles)\b/.test(normalized) && /\b(collection|collections|mint|minting|buy|cop|cope|hold|flip|invest|cheapest|floor)\b/.test(normalized),
        wantsGeneralChainInfo: wantsGeneralChainInfo,
        keywords: tokenize(query)
    };
}
function buildReason(project, corpus, intent, event) {
    // Note: Ethos score is intentionally NOT included here. It is rendered as a
    // colored badge on the recommendation card, so duplicating it in the prose
    // is noisy.
    var _a, _b, _c, _d, _e;
    if (intent.strictLending && /lending|borrow|loan|credit/.test(corpus)) {
        return (_a = project.jojoInsight) !== null && _a !== void 0 ? _a : 'Explicitly positioned around lending and borrowing in the current MegaBunnish data.';
    }
    // Generic vertical match: if the user asked for a vertical and this project
    // belongs to it, surface its insight directly.
    var matchedVertical = intent.verticals.find(function (entry) { return project.categories.includes(entry.category); });
    if (matchedVertical) {
        return (_b = project.jojoInsight) !== null && _b !== void 0 ? _b : "".concat(matchedVertical.label, " project in the current MegaETH ecosystem dataset.");
    }
    if ((_c = project.incentives) === null || _c === void 0 ? void 0 : _c.length) {
        return "Visible incentive: ".concat(project.incentives[0].title, ".");
    }
    if (event) {
        return "Relevant event: ".concat(event.title, ".");
    }
    return (_d = project.jojoInsight) !== null && _d !== void 0 ? _d : "".concat(project.name, " is a relevant ").concat((_e = project.categories[0]) !== null && _e !== void 0 ? _e : 'ecosystem', " project in the current site data.");
}
function findBestEvent(projectId, nowMs) {
    var _a, _b;
    var entries = APP_EVENTS.filter(function (event) { return event.projectId === projectId; })
        .map(function (event) {
        var startMs = new Date(event.start).getTime();
        var endMs = event.end ? new Date(event.end).getTime() : startMs;
        var isActive = startMs <= nowMs && endMs >= nowMs;
        var isUpcoming = startMs > nowMs;
        if (!isActive && !isUpcoming) {
            return null;
        }
        return {
            event: event,
            weight: isActive ? 2 : 1,
            distance: isActive ? 0 : startMs - nowMs
        };
    })
        .filter(function (entry) { return Boolean(entry); })
        .sort(function (left, right) { return right.weight - left.weight || left.distance - right.distance; });
    return (_b = (_a = entries[0]) === null || _a === void 0 ? void 0 : _a.event) !== null && _b !== void 0 ? _b : null;
}
function scoreProject(project, query, intent) {
    var _a, _b, _c;
    var corpus = buildCorpus(project);
    var normalizedQuery = normalize(query);
    var event = findBestEvent(project.id, Date.now());
    var ethos = ETHOS_BY_PROJECT_ID.get(project.id);
    var score = 0;
    if (intent.categories.some(function (category) { return project.categories.includes(category); })) {
        score += 30;
    }
    if (project.isLive) {
        score += 12;
    }
    if ((_a = project.incentives) === null || _a === void 0 ? void 0 : _a.length) {
        score += 12;
    }
    if (event) {
        score += 8;
    }
    var matchedKeywords = intent.keywords.filter(function (token) { return token.length > 2 && corpus.includes(token); });
    score += Math.min(18, matchedKeywords.length * 3);
    if (ethos) {
        score += Math.max(0, Math.min(18, Math.round((ethos.score - 1100) / 40)));
    }
    if (intent.strictLending) {
        if (/lending|borrow|loan|credit/.test(corpus)) {
            score += 40;
        }
        else if (project.categories.includes('DeFi')) {
            score += intent.preferIncentives && ((_b = project.incentives) === null || _b === void 0 ? void 0 : _b.length) ? 10 : -6;
        }
        else {
            score -= 20;
        }
    }
    // Generic vertical scoring — every vertical the user mentioned applies a
    // category bonus or a malus for off-vertical projects.
    if (intent.verticals.length) {
        var matchesAnyVertical = intent.verticals.some(function (entry) { return project.categories.includes(entry.category); });
        if (matchesAnyVertical) {
            score += 30;
        }
        else if (!intent.strictLending) {
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
    if (intent.preferLive && !project.isLive && !((_c = project.incentives) === null || _c === void 0 ? void 0 : _c.length) && !event) {
        score -= 8;
    }
    // Farming / airdrop intent: native MegaETH apps with no liquid token are the
    // only ones worth grinding. Heavily favor Native projects, drop the rest.
    if (intent.preferNative) {
        if (project.categories.includes('Native')) {
            score += 35;
        }
        else {
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
            }
            else if (ethos.score >= 1400) {
                score += 18;
            }
            else if (ethos.score >= 1200) {
                score += 8;
            }
            else {
                score -= 10;
            }
        }
        else {
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
        project: project,
        score: score,
        reason: buildReason(project, corpus, intent, event)
    };
}
function selectProjects(message, history) {
    // Intent and project ranking are based on the CURRENT message only.
    // Folding prior user messages into the query caused topic-bleed (e.g. an earlier
    // "ai" question forcing every follow-up to be ranked as AI). The LLM still sees
    // the full history via the messages array, so context is preserved.
    void history;
    var query = message;
    var intent = detectIntent(query);
    var explicitMatches = findExplicitProjectMatches(query);
    if (intent.wantsGeneralChainInfo && intent.categories.length === 0 && explicitMatches.length === 0) {
        return { ranked: [], intent: intent };
    }
    var scoredProjects = PROJECTS
        .map(function (project) { return scoreProject(project, query, intent); })
        .filter(function (entry) { return Boolean(entry); })
        .sort(function (left, right) { return right.score - left.score; });
    var forcedMatches = explicitMatches
        .filter(function (project) { return !scoredProjects.some(function (entry) { return entry.project.id === project.id; }); })
        .map(function (project) {
        var _a;
        return ({
            project: project,
            score: 999,
            reason: "Explicitly mentioned by name in the user query. ".concat((_a = project.jojoInsight) !== null && _a !== void 0 ? _a : "".concat(project.name, " appears in the current MegaBunnish ecosystem dataset."))
        });
    });
    return { ranked: __spreadArray(__spreadArray([], forcedMatches, true), scoredProjects, true).slice(0, 6), intent: intent };
}
function buildContextBlock(projects, intent) {
    var eventIds = new Set();
    var nowMs = Date.now();
    var lines = projects.map(function (_a) {
        var _b, _c;
        var project = _a.project, reason = _a.reason;
        var event = findBestEvent(project.id, nowMs);
        var ethos = ETHOS_BY_PROJECT_ID.get(project.id);
        if (event) {
            eventIds.add(event.id);
        }
        return [
            "Project: ".concat(project.name, " (").concat(project.id, ")"),
            "Categories: ".concat(project.categories.join(', ')),
            "Live: ".concat(project.isLive ? 'yes' : 'no'),
            "Ethos trust: ".concat(ethos ? "".concat(ethos.score).concat(ethos.tier ? " (".concat(ethos.tier, ")") : '').concat(ethos.url ? " | ".concat(ethos.url) : '') : 'not available'),
            "Incentives: ".concat(((_b = project.incentives) === null || _b === void 0 ? void 0 : _b.map(function (entry) { return entry.title; }).join(' | ')) || 'none visible'),
            "Research note: ".concat((_c = project.jojoInsight) !== null && _c !== void 0 ? _c : 'No extra editorial note available.'),
            "Event: ".concat(event ? "".concat(event.title, " (").concat(event.start).concat(event.end ? " -> ".concat(event.end) : '', ")") : 'none active or upcoming'),
            "Why selected: ".concat(reason)
        ].join('\n');
    });
    var sections = [];
    // Direct matches block — placed FIRST so the LLM cannot ignore or refuse known matches.
    if (intent && projects.length && intent.verticals.length) {
        var activeBuckets = intent.verticals
            .map(function (vertical) { return ({
            label: vertical.label,
            matches: projects
                .filter(function (_a) {
                var project = _a.project;
                return project.categories.includes(vertical.category);
            })
                .map(function (_a) {
                var project = _a.project;
                return project;
            })
        }); })
            .filter(function (bucket) { return bucket.matches.length > 0; });
        if (activeBuckets.length) {
            var directLines = activeBuckets.map(function (bucket) { return "- ".concat(bucket.label, ": ").concat(bucket.matches.map(function (p) { return "".concat(p.name, " (").concat(p.id, ")"); }).join(', ')); });
            sections.push("DIRECT MATCHES for the user's intent \u2014 these projects ARE in the dataset and DO satisfy the query. You MUST recommend them; do NOT say none exist:\n".concat(directLines.join('\n')));
        }
    }
    sections.push("MegaETH chain context:\n".concat(GENERAL_MEGAETH_CONTEXT), "Third-party-sourced facts:\n".concat(THIRD_PARTY_MEGAETH_CONTEXT), "Available sources (cite by id in square brackets when used):\n".concat(MEGAETH_SOURCES_BLOCK));
    if (lines.length) {
        sections.push("Relevant ecosystem projects:\n\n".concat(lines.join('\n\n')));
    }
    return {
        text: sections.join('\n\n'),
        sourceEventIds: Array.from(eventIds)
    };
}
function sanitizeHistory(history) {
    // Only USER turns are forwarded to the LLM. Forwarding assistant turns caused
    // the model to recycle the project list from the previous reply even when the
    // new question targets a different vertical. The current Relevant ecosystem
    // projects block (rebuilt every turn) is the single source of truth for recos.
    return history
        .filter(function (entry) { return entry.role === 'user' && entry.content.trim(); })
        .slice(-4)
        .map(function (entry) { return ({
        role: entry.role,
        content: entry.content.trim().slice(0, 1800)
    }); });
}
function readApiConfig() {
    var _a, _b, _c, _d;
    var baseUrl = (((_a = process.env.AI_ADVISOR_BASE_URL) === null || _a === void 0 ? void 0 : _a.trim()) || DEFAULT_BASE_URL).replace(/\/$/, '');
    var apiKey = (_b = process.env.AI_ADVISOR_API_KEY) === null || _b === void 0 ? void 0 : _b.trim();
    var model = ((_c = process.env.AI_ADVISOR_MODEL) === null || _c === void 0 ? void 0 : _c.trim()) || DEFAULT_MODEL;
    var configuredProvider = (_d = process.env.AI_ADVISOR_PROVIDER) === null || _d === void 0 ? void 0 : _d.trim().toLowerCase();
    var provider = configuredProvider === 'anthropic' || isAnthropicBaseUrl(baseUrl)
        ? 'anthropic'
        : 'openai-compatible';
    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
        throw new AiAdvisorConfigError('AI advisor is not configured. Set AI_ADVISOR_API_KEY, or point AI_ADVISOR_BASE_URL to a local OpenAI-compatible model endpoint such as Ollama.');
    }
    return {
        apiKey: apiKey,
        model: model,
        baseUrl: baseUrl,
        provider: provider
    };
}
function buildPrompt(message, history, contextText) {
    // Persona routing is based on the current message only, for the same reason as
    // intent detection: prior messages must not flip the persona on follow-ups.
    void history;
    var routingQuery = message;
    var memeMode = isMemeCulturePrompt(routingQuery) && !isSeriousTechnicalPrompt(routingQuery);
    var seriousPrompt = [
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
        'If evidence is weak, say so briefly, then still give the best grounded take you can.',
        'Use polished natural prose with complete sentences.',
        'Default to 2 to 5 short sentences, or up to 3 bullets for comparisons.',
        'When the user asks about farming, points, yield, rewards, safety, or app comparisons, be explicit about tradeoffs and risk.',
        'CRITICAL: For farming, airdrops, points, or incentive grinding, recommend ONLY MegaETH-native projects (those tagged Native, Megamafia, or Jojo). Non-native projects (Aave, GMX, Lido, Stargate, OpenSea, etc.) already have liquid tokens and are far less rewarding to farm — never recommend them for airdrop/farming questions.',
        'CRITICAL: When the user asks for NFT collections to buy, mint, or hold, recommend actual mintable collections (e.g. Glitchy Bunnies, Meganacci, Fluffle, Miniminds, Alzena). Never recommend NFT marketplaces (OpenSea, Rarible, NextRare, Magic Eden) as a "collection" — they are venues, not collections.',
        'When the user asks about safety, trust, reliability, or beginner-friendly choices, explicitly factor Ethos trust scores into the comparison, but never rely on Ethos alone.',
        'For token, ICO, public sale, TGE, or tokenomics questions, clearly separate disclosed facts from undisclosed details. State the 10B MEGA implied total supply when supply is asked, and cite the source.',
        'When you rely on a specific external source from the provided sources list, append a final line in the exact format: Sources: [id1], [id2]. Use only ids from the provided sources list. Do not invent ids or URLs. Omit the line entirely when no external source was used.'
    ].join(' ');
    var funnyPrompt = [
        'You are MegaBunny Chaos, the unserious culture-brainrot mode of MegaBunnish for MegaETH.',
        'Answer in English only.',
        'Your job is to be funny, internet-native, a bit degen, and in on the joke.',
        'Treat culture prompts, shitposts, vibe checks, and ecosystem memes as jokes to answer, not knowledge tests to refuse.',
        'Never say you do not know the meme, that it is not in your knowledge base, or that the term does not appear in the context, unless the user explicitly asks for a factual definition.',
        'If the phrase is weird, infer the vibe and commit to the bit.',
        'Reply in 1 to 3 short lines max.',
        'Make the first line funny, punchy, or knowingly absurd.',
        'You can use light crypto slang, but keep it readable.',
        'Do not invent important factual claims. If you add facts, keep them light and only if they improve the joke.',
        'Do not append sources unless you make a specific factual claim.',
        'Example style: User asks "is bread ass bullish for megaeth?". Good answer: "Absolutely. Bread ass is not a metric, it is a state of conviction. If MegaETH has sub-10ms blocks and the timeline is losing its mind, bread ass is spiritually bullish."',
        'Bad answer: "I do not have information about bread ass in relation to MegaETH." Never give that kind of answer in this mode.'
    ].join(' ');
    var systemPrompt = memeMode ? funnyPrompt : seriousPrompt;
    var modePrompt = memeMode
        ? 'This is a meme or culture prompt. Stay in MegaBunny Chaos mode and commit to the joke.'
        : 'This is a serious or technical prompt. Stay in MegaBunny Analyst mode and optimize for signal, clarity, and grounded usefulness.';
    var messages = __spreadArray(__spreadArray(__spreadArray(__spreadArray([
        { role: 'system', content: systemPrompt }
    ], (modePrompt ? [{ role: 'system', content: modePrompt }] : []), true), [
        { role: 'system', content: "MegaBunnish context:\n\n".concat(contextText) }
    ], false), history.map(function (entry) { return ({ role: entry.role, content: entry.content }); }), true), [
        { role: 'user', content: message }
    ], false);
    return messages;
}
function requestCompletion(messages) {
    return __awaiter(this, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            config = readApiConfig();
            if (config.provider === 'anthropic') {
                return [2 /*return*/, requestAnthropicCompletion(config, messages)];
            }
            return [2 /*return*/, requestOpenAiCompatibleCompletion(config, messages)];
        });
    });
}
function requestOpenAiCompatibleCompletion(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, body, payload, content, text;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    headers = {
                        'Content-Type': 'application/json'
                    };
                    if (config.apiKey) {
                        headers.Authorization = "Bearer ".concat(config.apiKey);
                    }
                    return [4 /*yield*/, fetch("".concat(config.baseUrl, "/chat/completions"), {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({
                                model: config.model,
                                temperature: 0.7,
                                max_tokens: 300,
                                messages: messages
                            })
                        })];
                case 1:
                    response = _d.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    body = _d.sent();
                    throw new Error("AI advisor request failed (".concat(response.status, "): ").concat(body || response.statusText));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    payload = (_d.sent());
                    content = (_c = (_b = (_a = payload.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
                    if (typeof content === 'string') {
                        return [2 /*return*/, content.trim()];
                    }
                    if (Array.isArray(content)) {
                        text = content
                            .map(function (entry) { var _a; return (entry.type === 'text' || !entry.type ? (_a = entry.text) !== null && _a !== void 0 ? _a : '' : ''); })
                            .join('')
                            .trim();
                        if (text) {
                            return [2 /*return*/, text];
                        }
                    }
                    throw new Error('AI advisor returned an empty response.');
            }
        });
    });
}
function requestAnthropicCompletion(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var systemMessages, userAssistantMessages, systemPrompt, response, body, payload, text;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!config.apiKey) {
                        throw new AiAdvisorConfigError('Anthropic requires AI_ADVISOR_API_KEY.');
                    }
                    systemMessages = messages.filter(function (entry) { return entry.role === 'system'; });
                    userAssistantMessages = messages.filter(function (entry) { return entry.role !== 'system'; });
                    systemPrompt = systemMessages.map(function (entry) { return entry.content; }).join('\n\n');
                    return [4 /*yield*/, fetch("".concat(config.baseUrl, "/messages"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-key': config.apiKey,
                                'anthropic-version': '2023-06-01'
                            },
                            body: JSON.stringify({
                                model: config.model,
                                max_tokens: 300,
                                temperature: 0.7,
                                system: systemPrompt,
                                messages: userAssistantMessages.map(function (entry) { return ({
                                    role: entry.role,
                                    content: entry.content
                                }); })
                            })
                        })];
                case 1:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    body = _b.sent();
                    throw new Error("AI advisor request failed (".concat(response.status, "): ").concat(body || response.statusText));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    payload = (_b.sent());
                    text = (_a = payload.content) === null || _a === void 0 ? void 0 : _a.map(function (entry) { var _a; return (entry.type === 'text' || !entry.type ? (_a = entry.text) !== null && _a !== void 0 ? _a : '' : ''); }).join('').trim();
                    if (!text) {
                        throw new Error('AI advisor returned an empty response.');
                    }
                    return [2 /*return*/, text];
            }
        });
    });
}
export function generateAiAdvisorReply(input) {
    return __awaiter(this, void 0, void 0, function () {
        var message, history, _a, rankedProjects, intent, context, promptMessages, answer;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    message = input.message.trim();
                    if (!message) {
                        throw new Error('Message is required.');
                    }
                    history = sanitizeHistory((_b = input.history) !== null && _b !== void 0 ? _b : []);
                    _a = selectProjects(message, history), rankedProjects = _a.ranked, intent = _a.intent;
                    context = buildContextBlock(rankedProjects, intent);
                    promptMessages = buildPrompt(message, history, context.text);
                    return [4 /*yield*/, requestCompletion(promptMessages)];
                case 1:
                    answer = _d.sent();
                    return [2 /*return*/, {
                            answer: answer,
                            conversationId: ((_c = input.conversationId) === null || _c === void 0 ? void 0 : _c.trim()) || randomUUID(),
                            recommendations: rankedProjects.slice(0, 4).map(function (_a) {
                                var project = _a.project, reason = _a.reason;
                                return ({
                                    projectId: project.id,
                                    reason: reason
                                });
                            }),
                            sourceProjectIds: rankedProjects.map(function (_a) {
                                var project = _a.project;
                                return project.id;
                            }),
                            sourceEventIds: context.sourceEventIds,
                            suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS
                        }];
            }
        });
    });
}
// Internal helpers exposed for local repro/test scripts only.
export var __testables = {
    detectIntent: detectIntent,
    selectProjects: selectProjects,
    buildContextBlock: buildContextBlock,
    buildPrompt: buildPrompt
};
