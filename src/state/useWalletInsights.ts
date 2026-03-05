import { useCallback, useRef, useState } from 'react';
import { INTERACTION_CONTRACT_MAP, NFT_CONTRACT_MAP } from '../data/contractDirectory';
import rawProjects from '../data/projects.json';

export type WalletStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ContractDirectoryStatus = 'idle' | 'loading' | 'error';

export type WalletInsights = {
  walletAddress: string | null;
  walletInput: string;
  walletStatus: WalletStatus;
  walletError: string | null;
  walletTransactionCount: number;
  walletUniqueContractCount: number;
  walletDiscoveredApps: {
    address: string;
    label: string;
    interactions: number;
    tags: string[];
  }[];
  walletDexProtocols: {
    address: string;
    label: string;
    interactions: number;
  }[];
  walletLpPositions: {
    contractAddress: string;
    symbol: string;
    name: string;
    balance: number;
  }[];
  walletNftCollections: {
    contractAddress: string;
    symbol: string;
    name: string;
    balance: number;
    imageUrl?: string;
  }[];
  walletNftAssets: {
    contractAddress: string;
    tokenId: string;
    name: string;
    collectionName: string;
    imageUrl?: string;
    projectId?: string;
  }[];
  walletInteractionCounts: Record<string, number>;
  walletNftHoldings: Record<string, number>;
  walletUpdatedAt: number | null;
  contractDirectoryStatus: ContractDirectoryStatus;
  setWalletInput: (value: string) => void;
  submitWallet: () => void;
  clearWallet: () => void;
  refreshWalletInsights: () => void;
};

type BlockscoutArrayResponse<T> = {
  status?: '0' | '1';
  message?: string;
  result?: T[] | string;
};
type BlockscoutTransaction = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  nonce: string;
  from: string;
  to: string;
  contractAddress: string;
  value: string;
  isError: string;
};

type BlockscoutV2AddressRef = {
  hash: string | null;
  name?: string | null;
  is_contract?: boolean;
  implementations?: Array<{
    name?: string | null;
  }>;
};

type BlockscoutV2Transaction = {
  hash: string;
  block_number?: number;
  timestamp?: string;
  nonce?: number;
  from?: BlockscoutV2AddressRef | null;
  to?: BlockscoutV2AddressRef | null;
  status?: string;
  value?: string;
  method?: string | null;
  decoded_input?: {
    method_call?: string;
    method_id?: string;
  } | null;
  transaction_types?: string[];
};

type BlockscoutV2TransactionsResponse = {
  items?: BlockscoutV2Transaction[];
  next_page_params?: Record<string, string | number | null>;
};

type BlockscoutNftTransfer = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenID: string;
  tokenName?: string;
  tokenSymbol?: string;
};

type BlockscoutInternalTransaction = {
  from: string;
  to: string;
  contractAddress?: string;
  isError?: string;
  hash?: string;
};

type BlockscoutTokenTransfer = {
  from: string;
  to: string;
  contractAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  value?: string;
};

const BLOCKSCOUT_API_URL = 'https://megaeth.blockscout.com/api';
const BLOCKSCOUT_V2_API_URL = 'https://megaeth.blockscout.com/api/v2';
const BLOCKSCOUT_API_KEY = (import.meta.env.VITE_ETHERSCAN_API_KEY || 'YourApiKeyToken').trim();
const OPENSEA_API_URL = 'https://api.opensea.io/api/v2';
const OPENSEA_CHAIN = 'ethereum';
const OPENSEA_API_KEY = (import.meta.env.VITE_OPENSEA_API_KEY || '184348b5edb040b78aa4df9f41abbf5b').trim();
const BAD_BUNNZ_ETH_CONTRACT = '0xbdb13add477e76c1df52192d4f5f4dd67f6a40d8';
const DIGIT_RABBITS_ETH_CONTRACT = '0x0dc2a6df9ce984f1d7cbcb662fb44a87779ec30a';
const EXCLUDED_NFT_PROJECT_IDS = new Set(['digitrabbits']);
const ADDRESS_REQUIRED_ERROR = 'MegaETH address required';
const ADDRESS_INVALID_ERROR = 'Invalid MegaETH address';
const BLOCKSCOUT_GENERIC_ERROR = 'Unable to reach Blockscout. Try again later.';
const NFT_PAGE_SIZE = '120';
const TOKEN_PAGE_SIZE = '120';
const INTERNAL_PAGE_SIZE = '120';
const MAX_TRANSACTION_PAGES = 18;
const MAX_TRANSACTION_RESULTS = 1400;
const MAX_TOKEN_PAGES = 12;
const MAX_NFT_PAGES = 80;
const MAX_INTERNAL_PAGES = 12;

const DEX_METHOD_KEYWORDS = ['swap', 'exactinput', 'exactoutput', 'multicall'];
const LP_METHOD_KEYWORDS = ['addliquidity', 'removeliquidity', 'mint', 'burn', 'deposit', 'withdraw', 'stake', 'unstake'];

const looksLikeLpToken = (symbol: string, name: string) => {
  const s = symbol.toLowerCase();
  const n = name.toLowerCase();
  return (
    s.includes('lp') ||
    s.includes('uni-v2') ||
    s.includes('slp') ||
    n.includes('liquidity provider') ||
    n.includes('lp token') ||
    n.includes('pool') ||
    n.includes('yield')
  );
};
type OpenSeaNftItem = {
  identifier?: string;
  contract?: string | { address?: string };
  image_url?: string;
  display_image_url?: string;
  collection?: string;
  name?: string;
  token_standard?: string;
  contract_address?: string;
  collection_name?: string;
};

type OpenSeaNftsResponse = {
  nfts?: OpenSeaNftItem[];
  next?: string | null;
};

type OpenSeaNftResponse = {
  nft?: OpenSeaNftItem;
};

const toNumberAmount = (rawValue: string | undefined, decimalsRaw: string | undefined) => {
  const decimals = Number(decimalsRaw ?? '18');
  const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.min(decimals, 30) : 18;
  if (!rawValue) {
    return 0;
  }
  const normalized = rawValue.replace(/[^0-9]/g, '');
  if (!normalized) {
    return 0;
  }
  const pad = safeDecimals;
  if (normalized.length <= pad) {
    return Number(`0.${normalized.padStart(pad, '0')}`);
  }
  const head = normalized.slice(0, normalized.length - pad);
  const tail = normalized.slice(normalized.length - pad, normalized.length - Math.max(0, pad - 4));
  return Number(`${head}.${tail || '0'}`);
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();
const normalizeTokenId = (value: string) => {
  const cleaned = (value ?? '').trim();
  if (!cleaned) {
    return '';
  }
  try {
    if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
      return BigInt(cleaned).toString();
    }
    if (/^[0-9]+$/.test(cleaned)) {
      return BigInt(cleaned).toString();
    }
  } catch {
    return cleaned.toLowerCase();
  }
  return cleaned.toLowerCase();
};

const buildTokenIdCandidates = (value: string) => {
  const raw = (value ?? '').trim();
  if (!raw) {
    return [] as string[];
  }

  const candidates = new Set<string>();
  candidates.add(raw);
  candidates.add(raw.toLowerCase());
  candidates.add(normalizeTokenId(raw));

  try {
    const bigintValue = raw.startsWith('0x') || raw.startsWith('0X') ? BigInt(raw) : BigInt(raw);
    candidates.add(bigintValue.toString());
    candidates.add(`0x${bigintValue.toString(16)}`);
  } catch {
    // ignore parse errors
  }

  return Array.from(candidates).filter(Boolean);
};
const isMegaEthAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());
const extractMegaEthAddress = (value: string) => {
  const cleaned = value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!cleaned) {
    return null;
  }
  const direct = cleaned.match(/^0x[a-fA-F0-9]{40}$/);
  if (direct) {
    return normalizeAddress(direct[0]);
  }
  const embedded = cleaned.match(/0x[a-fA-F0-9]{40}/);
  if (embedded) {
    return normalizeAddress(embedded[0]);
  }
  return null;
};

const buildBlockscoutUrl = (params: Record<string, string>) => {
  const url = new URL(BLOCKSCOUT_API_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (BLOCKSCOUT_API_KEY) {
    url.searchParams.set('apikey', BLOCKSCOUT_API_KEY);
  }
  return url.toString();
};

const fetchBlockscoutArray = async <T>(params: Record<string, string>): Promise<T[]> => {
  const response = await fetch(buildBlockscoutUrl(params));
  if (!response.ok) {
    throw new Error(BLOCKSCOUT_GENERIC_ERROR);
  }

  const payload = (await response.json()) as BlockscoutArrayResponse<T>;
  const message = payload.message?.toLowerCase() ?? '';
  const resultArray = Array.isArray(payload.result) ? payload.result : [];

  const isExplicitSuccess = payload.status === '1';
  const isImplicitSuccess = !payload.status && (message === 'ok' || resultArray.length > 0);

  if (isExplicitSuccess || isImplicitSuccess) {
    return resultArray;
  }

  if (
    message.includes('no transactions') ||
    message.includes('no token transfers') ||
    message.includes('no internal transactions') ||
    message.includes('no nfts found')
  ) {
    return [];
  }

  throw new Error(payload.message || BLOCKSCOUT_GENERIC_ERROR);
};

const buildV2TransactionsUrl = (address: string, params?: Record<string, string>) => {
  const url = new URL(`${BLOCKSCOUT_V2_API_URL}/addresses/${address}/transactions`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const mapV2Transaction = (tx: BlockscoutV2Transaction): BlockscoutTransaction | null => {
  const toAddress = tx.to?.hash;
  if (!toAddress) {
    return null;
  }
  const timestampMs = tx.timestamp ? Date.parse(tx.timestamp) : NaN;
  return {
    hash: tx.hash,
    blockNumber: String(tx.block_number ?? ''),
    timeStamp: Number.isFinite(timestampMs) ? String(Math.floor(timestampMs / 1000)) : '',
    nonce: String(tx.nonce ?? ''),
    from: tx.from?.hash ?? '',
    to: toAddress,
    contractAddress: toAddress,
    value: tx.value ?? '0',
    isError: tx.status === 'ok' ? '0' : '1'
  };
};

const sanitizeNextPageParams = (params?: Record<string, string | number | null>) => {
  if (!params) {
    return undefined;
  }
  const sanitized = Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === null || typeof value === 'undefined') {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
  return Object.keys(sanitized).length ? sanitized : undefined;
};

const normalizeCollectionKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeProjectAliasKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const NFT_PROJECT_ALIASES: Record<string, string> = {
  badbunnz: 'bad-bunnz',
  'bad bunnz': 'bad-bunnz',
  digitrabbits: 'digitrabbits',
  'digit rabbits': 'digitrabbits',
  meganame: 'dotmegadomains',
  'mega name': 'dotmegadomains',
  megadomains: 'dotmegadomains',
  'mega domains': 'dotmegadomains',
  'mega domain': 'dotmegadomains',
  '.mega': 'dotmegadomains',
  dotmega: 'dotmegadomains',
  'dotmega domains': 'dotmegadomains',
  'world computer netizens': 'netizens',
  netizens: 'netizens',
  megalio: 'megalio',
  meganacci: 'meganacci',
  lemonade: 'lemonade',
  lemonadedapp: 'lemonade',
  'lemonade social': 'lemonade',
  fluffle: 'fluffle',
  odds: 'odds',
  megapunks: 'mega-punk',
  'mega punks': 'mega-punk',
  'mega punk': 'mega-punk'
};

const NFT_PROJECT_ID_EXCEPTIONS = new Set<string>(['dotmegadomains', 'lemonade']);

const extractAddressFromText = (value: string) => {
  const match = value.match(/0x[a-fA-F0-9]{40}/);
  return match ? normalizeAddress(match[0]) : null;
};

const NFT_ECOSYSTEM_PROJECTS = (rawProjects as Array<{
  id: string;
  name: string;
  categories?: string[];
  links?: { nft?: string };
}>).filter((project) => {
  const hasNftCategory = (project.categories ?? []).some(
    (category) => category.trim().toLowerCase() === 'nft'
  );
  const hasNftLink = Boolean(project.links?.nft);
  const hasKnownNftContract = Object.values(NFT_CONTRACT_MAP).includes(project.id);
  const isException = NFT_PROJECT_ID_EXCEPTIONS.has(project.id);
  return hasNftCategory || hasNftLink || hasKnownNftContract || isException;
});

const NFT_ECOSYSTEM_PROJECT_IDS = new Set(NFT_ECOSYSTEM_PROJECTS.map((project) => project.id));

const NFT_LINK_CONTRACT_PROJECT_MAP = NFT_ECOSYSTEM_PROJECTS.reduce<Record<string, string>>((acc, project) => {
  const nftLink = project.links?.nft;
  if (!nftLink) {
    return acc;
  }
  const extracted = extractAddressFromText(nftLink);
  if (extracted) {
    acc[extracted] = project.id;
  }
  return acc;
}, {});

const NFT_ECOSYSTEM_PROJECT_ALIASES = NFT_ECOSYSTEM_PROJECTS.reduce<Record<string, string>>((acc, project) => {
  const keys = [project.id, project.id.replace(/-/g, ' '), project.name]
    .map(normalizeProjectAliasKey)
    .filter(Boolean);

  keys.forEach((key) => {
    if (!acc[key]) {
      acc[key] = project.id;
    }
  });

  return acc;
}, {});

const KNOWN_MEGAETH_NFT_CONTRACTS = (() => {
  const contracts = new Set<string>(Object.keys(NFT_CONTRACT_MAP).map((address) => normalizeAddress(address)));
  NFT_ECOSYSTEM_PROJECTS.forEach((project) => {
    const nftLink = project.links?.nft;
    if (!nftLink) {
      return;
    }
    const extracted = extractAddressFromText(nftLink);
    if (extracted) {
      contracts.add(extracted);
    }
  });
  contracts.add(BAD_BUNNZ_ETH_CONTRACT);
  return contracts;
})();

const resolveProjectIdFromNft = (
  contractAddress: string,
  collectionName: string,
  nftName: string,
  symbol: string
) => {
  const normalizedContract = normalizeAddress(contractAddress);
  const byContract = NFT_CONTRACT_MAP[normalizedContract];
  if (byContract) {
    return byContract;
  }

  const byNftLinkContract = NFT_LINK_CONTRACT_PROJECT_MAP[normalizedContract];
  if (byNftLinkContract) {
    return byNftLinkContract;
  }

  const keys = [collectionName, nftName, symbol]
    .map(normalizeProjectAliasKey)
    .filter(Boolean);

  for (const key of keys) {
    const alias = NFT_PROJECT_ALIASES[key];
    if (alias) {
      return alias;
    }
  }

  for (const key of keys) {
    const exact = NFT_ECOSYSTEM_PROJECT_ALIASES[key];
    if (exact) {
      return exact;
    }
  }

  return undefined;
};

const COLLECTION_IMAGE_ALIASES: Record<string, string[]> = {
  'nacci cartel': ['nacci cartel', 'meganacci', 'nacci'],
  'aveforge genesis': ['aveforge genesis', 'ave forge genesis', 'aveforge'],
  'aveforge genesis pass': ['aveforge genesis pass', 'ave forge genesis pass', 'aveforge genesis'],
  'bad bunnz': ['bad bunnz', 'badbunnz'],
  digitrabbits: ['digitrabbits', 'digit rabbits']
};

const collectionTokens = (value: string) =>
  normalizeCollectionKey(value)
    .split(' ')
    .filter((token) => token.length >= 3);

const resolveOpenSeaImageFromCandidates = (
  target: { name: string; symbol: string },
  byKey: Map<string, string>,
  candidates: Array<{ name: string; symbol: string; imageUrl: string }>
) => {
  const directKeys = [normalizeCollectionKey(target.name), normalizeCollectionKey(target.symbol)].filter(Boolean);
  for (const key of directKeys) {
    const image = byKey.get(key);
    if (image) {
      return image;
    }
  }

  const aliasKeys = new Set<string>();
  directKeys.forEach((key) => {
    aliasKeys.add(key);
    (COLLECTION_IMAGE_ALIASES[key] ?? []).forEach((alias) => aliasKeys.add(normalizeCollectionKey(alias)));
  });
  for (const aliasKey of aliasKeys) {
    const image = byKey.get(aliasKey);
    if (image) {
      return image;
    }
  }

  const targetTokenSet = new Set([...collectionTokens(target.name), ...collectionTokens(target.symbol)]);
  if (!targetTokenSet.size) {
    return undefined;
  }

  let bestImage: string | undefined;
  let bestScore = 0;
  candidates.forEach((candidate) => {
    const candidateTokens = new Set([...collectionTokens(candidate.name), ...collectionTokens(candidate.symbol)]);
    if (!candidateTokens.size) {
      return;
    }
    let common = 0;
    targetTokenSet.forEach((token) => {
      if (candidateTokens.has(token)) {
        common += 1;
      }
    });
    if (common <= 0) {
      return;
    }

    const similarity = common / Math.max(targetTokenSet.size, candidateTokens.size);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestImage = candidate.imageUrl;
    }
  });

  return bestScore >= 0.4 ? bestImage : undefined;
};

const fetchPaginatedAccountAction = async <T>(
  action: 'tokentx' | 'tokennfttx' | 'txlistinternal',
  address: string,
  pageSize: string,
  maxPages: number
) => {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const chunk = await fetchBlockscoutArray<T>({
      module: 'account',
      action,
      address,
      sort: 'desc',
      page: String(page),
      offset: pageSize
    });
    if (!chunk.length) {
      break;
    }
    items.push(...chunk);
    if (chunk.length < Number(pageSize)) {
      break;
    }
  }
  return items;
};

const fetchLatestTransactions = async (address: string) => {
  const collected: BlockscoutV2Transaction[] = [];
  let pageParams: Record<string, string> | undefined;

  for (let pageIndex = 0; pageIndex < MAX_TRANSACTION_PAGES; pageIndex += 1) {
    if (collected.length >= MAX_TRANSACTION_RESULTS) {
      break;
    }

    const response = await fetch(buildV2TransactionsUrl(address, pageParams));
    if (!response.ok) {
      throw new Error(BLOCKSCOUT_GENERIC_ERROR);
    }

    const payload = (await response.json()) as BlockscoutV2TransactionsResponse;
    const items = payload.items ?? [];
    if (!items.length) {
      break;
    }

    collected.push(...items);
    pageParams = sanitizeNextPageParams(payload.next_page_params);

    if (!pageParams) {
      break;
    }
  }

  return collected.slice(0, MAX_TRANSACTION_RESULTS);
};

const fetchTokenTransfers = (address: string) =>
  fetchPaginatedAccountAction<BlockscoutTokenTransfer>('tokentx', address, TOKEN_PAGE_SIZE, MAX_TOKEN_PAGES);

const fetchNftTransfers = (address: string) =>
  fetchPaginatedAccountAction<BlockscoutNftTransfer>('tokennfttx', address, NFT_PAGE_SIZE, MAX_NFT_PAGES);

const fetchOpenSeaPage = async (url: string) => {
  const primaryHeaders: HeadersInit = { accept: 'application/json' };
  if (OPENSEA_API_KEY) {
    primaryHeaders['x-api-key'] = OPENSEA_API_KEY;
  }

  let response = await fetch(url, { headers: primaryHeaders });

  if (!response.ok && OPENSEA_API_KEY && [401, 403, 429].includes(response.status)) {
    response = await fetch(url, {
      headers: {
        accept: 'application/json'
      }
    });
  }

  if (!response.ok) {
    throw new Error('Unable to reach OpenSea.');
  }

  return response;
};

const fetchOpenSeaNftImageByToken = async (contractAddress: string, tokenId: string) => {
  const normalizedContract = normalizeAddress(contractAddress);
  const tokenCandidates = buildTokenIdCandidates(tokenId);
  if (!normalizedContract || !tokenCandidates.length) {
    return undefined;
  }

  for (const candidate of tokenCandidates) {
    const url = `${OPENSEA_API_URL}/chain/${OPENSEA_CHAIN}/contract/${normalizedContract}/nfts/${encodeURIComponent(candidate)}`;
    try {
      const response = await fetchOpenSeaPage(url);
      const payload = (await response.json()) as OpenSeaNftResponse;
      const nft = payload.nft;
      const imageUrl = nft?.display_image_url || nft?.image_url;
      if (imageUrl) {
        return imageUrl;
      }
    } catch {
      continue;
    }
  }

  return undefined;
};

const resolveOpenSeaContractAddress = (nft: OpenSeaNftItem) => {
  if (typeof nft.contract === 'string') {
    return normalizeAddress(nft.contract);
  }
  if (nft.contract && typeof nft.contract === 'object' && nft.contract.address) {
    return normalizeAddress(nft.contract.address);
  }
  if (nft.contract_address) {
    return normalizeAddress(nft.contract_address);
  }
  return '';
};

const fetchOpenSeaNfts = async (address: string) => {
  if (!OPENSEA_API_KEY) {
    return {
      assets: [] as WalletInsights['walletNftAssets'],
      collections: [] as WalletInsights['walletNftCollections']
    };
  }

  let cursor: string | null = null;
  const maxPages = 30;
  const collections = new Map<string, { symbol: string; name: string; balance: number; imageUrl?: string }>();
  const assets: WalletInsights['walletNftAssets'] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${OPENSEA_API_URL}/chain/${OPENSEA_CHAIN}/account/${address}/nfts`);
    url.searchParams.set('limit', '50');
    if (cursor) {
      url.searchParams.set('next', cursor);
    }

    const response = await fetchOpenSeaPage(url.toString());

    const payload = (await response.json()) as OpenSeaNftsResponse;
    const nfts = payload.nfts ?? [];
    if (!nfts.length) {
      break;
    }

    nfts.forEach((nft) => {
      const contractAddress = resolveOpenSeaContractAddress(nft);
      if (!contractAddress || !isMegaEthAddress(contractAddress)) {
        return;
      }

      if (contractAddress === DIGIT_RABBITS_ETH_CONTRACT) {
        return;
      }

      const tokenId = (nft.identifier ?? '').trim();
      if (!tokenId) {
        return;
      }

      const imageUrl = nft.display_image_url || nft.image_url || undefined;
      const collectionName =
        nft.collection_name?.trim() || nft.collection?.trim() || nft.name?.trim() || 'Unknown collection';
      const nftName = nft.name?.trim() || `${collectionName} #${tokenId}`;
      const projectId = resolveProjectIdFromNft(contractAddress, collectionName, nftName, '');
      if (projectId && EXCLUDED_NFT_PROJECT_IDS.has(projectId)) {
        return;
      }
      const isBadBunnz = contractAddress === BAD_BUNNZ_ETH_CONTRACT;
      const isKnownMegaEthNftContract = KNOWN_MEGAETH_NFT_CONTRACTS.has(contractAddress);
      const isKnownNftProject = projectId ? NFT_ECOSYSTEM_PROJECT_IDS.has(projectId) : false;
      if (!isKnownMegaEthNftContract && !isKnownNftProject && !isBadBunnz) {
        return;
      }

      assets.push({
        contractAddress,
        tokenId,
        name: nftName,
        collectionName,
        imageUrl,
        projectId
      });

      const existing = collections.get(contractAddress) ?? {
        symbol: 'NFT',
        name: collectionName,
        balance: 0,
        imageUrl
      };

      existing.balance += 1;
      if (!existing.imageUrl) {
        existing.imageUrl = imageUrl;
      }

      collections.set(contractAddress, existing);
    });

    cursor = payload.next ?? null;
    if (!cursor) {
      break;
    }
  }

  const normalizedCollections = Array.from(collections.entries())
    .map(([contractAddress, entry]) => ({
      contractAddress,
      symbol: entry.symbol,
      name: entry.name,
      balance: entry.balance,
      imageUrl: entry.imageUrl
    }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.contractAddress.localeCompare(b.contractAddress));

  return {
    assets,
    collections: normalizedCollections
  };
};
const fetchInternalTransactions = (address: string) =>
  fetchPaginatedAccountAction<BlockscoutInternalTransaction>(
    'txlistinternal',
    address,
    INTERNAL_PAGE_SIZE,
    MAX_INTERNAL_PAGES
  );

const aggregateInteractionCounts = (transactions: BlockscoutV2Transaction[]) => {
  return transactions.reduce<Record<string, number>>((acc, tx) => {
    const toAddress = tx.to?.hash ? normalizeAddress(tx.to.hash) : null;
    if (tx.status !== 'ok' || !toAddress) {
      return acc;
    }
    const projectId = INTERACTION_CONTRACT_MAP[toAddress];
    if (!projectId) {
      return acc;
    }
    acc[projectId] = (acc[projectId] || 0) + 1;
    return acc;
  }, {});
};

const aggregateDiscoveredApps = (
  transactions: BlockscoutV2Transaction[],
  internalTransactions: BlockscoutInternalTransaction[],
  tokenTransfers: BlockscoutTokenTransfer[],
  nftCollections: Array<{ contractAddress: string; symbol: string; name: string; balance: number }>
) => {
  const appMap = new Map<string, { label: string; interactions: number; tags: Set<string> }>();
  const dexMap = new Map<string, { label: string; interactions: number }>();
  const uniqueContractSet = new Set<string>();
  const txLabelByAddress = new Map<string, string>();

  const upsertApp = (addressRaw: string, labelRaw: string, tags: string[], increment = 1) => {
    const address = normalizeAddress(addressRaw);
    if (!address || !isMegaEthAddress(address)) {
      return;
    }
    const label = labelRaw?.trim() || address;
    const existing = appMap.get(address) ?? { label, interactions: 0, tags: new Set<string>() };
    if (!existing.label || existing.label === address) {
      existing.label = label;
    }
    existing.interactions += increment;
    tags.forEach((tag) => existing.tags.add(tag));
    appMap.set(address, existing);
    uniqueContractSet.add(address);
  };

  transactions.forEach((tx) => {
    const to = tx.to;
    const toAddress = to?.hash ? normalizeAddress(to.hash) : null;
    if (!toAddress || !to?.is_contract || tx.status !== 'ok') {
      return;
    }

    const methodText = `${tx.method ?? ''} ${tx.decoded_input?.method_call ?? ''}`.toLowerCase();
    const label = to.name?.trim() || to.implementations?.[0]?.name?.trim() || toAddress;
    txLabelByAddress.set(toAddress, label);
    upsertApp(toAddress, label, ['Contract']);

    const isDex = DEX_METHOD_KEYWORDS.some((keyword) => methodText.includes(keyword));
    const isLp = LP_METHOD_KEYWORDS.some((keyword) => methodText.includes(keyword));
    const isApproval = methodText.includes('approve(') || methodText.includes('approve ');

    if (isDex) {
      upsertApp(toAddress, label, ['DEX'], 0);
      const dexExisting = dexMap.get(toAddress) ?? { label, interactions: 0 };
      dexExisting.interactions += 1;
      dexMap.set(toAddress, dexExisting);
    }
    if (isLp) {
      upsertApp(toAddress, label, ['LP'], 0);
    }
    if (isApproval) {
      upsertApp(toAddress, label, ['Token'], 0);
    }
  });

  internalTransactions.forEach((tx) => {
    if (tx.isError === '1') {
      return;
    }
    const toAddress = tx.to ? normalizeAddress(tx.to) : '';
    if (!toAddress || !isMegaEthAddress(toAddress)) {
      return;
    }
    const label = txLabelByAddress.get(toAddress) ?? toAddress;
    upsertApp(toAddress, label, ['Internal']);
  });

  tokenTransfers.forEach((transfer) => {
    const contractAddress = normalizeAddress(transfer.contractAddress);
    if (!contractAddress || !isMegaEthAddress(contractAddress)) {
      return;
    }
    const label = transfer.tokenName?.trim() || transfer.tokenSymbol?.trim() || txLabelByAddress.get(contractAddress) || contractAddress;
    const tags = ['Token'];
    if (looksLikeLpToken(transfer.tokenSymbol?.trim() ?? '', transfer.tokenName?.trim() ?? '')) {
      tags.push('LP');
    }
    upsertApp(contractAddress, label, tags);
  });

  nftCollections.forEach((collection) => {
    const contractAddress = normalizeAddress(collection.contractAddress);
    if (!contractAddress || !isMegaEthAddress(contractAddress)) {
      return;
    }
    const label = collection.name?.trim() || collection.symbol?.trim() || txLabelByAddress.get(contractAddress) || contractAddress;
    upsertApp(contractAddress, label, ['NFT'], Math.max(1, collection.balance));
  });

  const discoveredApps = Array.from(appMap.entries())
    .map(([address, entry]) => ({
      address,
      label: entry.label,
      interactions: entry.interactions,
      tags: Array.from(entry.tags)
    }))
    .sort((a, b) => b.interactions - a.interactions || a.address.localeCompare(b.address));

  const dexProtocols = Array.from(dexMap.entries())
    .map(([address, entry]) => ({
      address,
      label: entry.label,
      interactions: entry.interactions
    }))
    .sort((a, b) => b.interactions - a.interactions || a.address.localeCompare(b.address));

  return {
    discoveredApps,
    dexProtocols,
    uniqueContractCount: uniqueContractSet.size
  };
};

const aggregateLpPositions = (transfers: BlockscoutTokenTransfer[], walletAddress: string) => {
  const normalizedWallet = normalizeAddress(walletAddress);
  const map = new Map<string, { symbol: string; name: string; balance: number }>();

  transfers.forEach((transfer) => {
    const symbol = transfer.tokenSymbol?.trim() ?? 'Unknown';
    const name = transfer.tokenName?.trim() ?? 'Unknown token';
    if (!looksLikeLpToken(symbol, name)) {
      return;
    }

    const contractAddress = normalizeAddress(transfer.contractAddress);
    const delta = toNumberAmount(transfer.value, transfer.tokenDecimal);
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }

    const toWallet = normalizeAddress(transfer.to) === normalizedWallet;
    const fromWallet = normalizeAddress(transfer.from) === normalizedWallet;
    if (!toWallet && !fromWallet) {
      return;
    }

    const current = map.get(contractAddress) ?? { symbol, name, balance: 0 };
    current.balance += toWallet ? delta : -delta;
    map.set(contractAddress, current);
  });

  return Array.from(map.entries())
    .filter(([, value]) => value.balance > 0)
    .map(([contractAddress, value]) => ({
      contractAddress,
      symbol: value.symbol,
      name: value.name,
      balance: Number(value.balance.toFixed(4))
    }))
    .sort((a, b) => b.balance - a.balance || a.contractAddress.localeCompare(b.contractAddress));
};

const aggregateNftCollections = (transfers: BlockscoutNftTransfer[], walletAddress: string) => {
  const normalizedWallet = normalizeAddress(walletAddress);
  const map = new Map<string, { symbol: string; name: string; tokenIds: Set<string> }>();

  transfers.forEach((transfer) => {
    const contractAddress = normalizeAddress(transfer.contractAddress);
    if (contractAddress === DIGIT_RABBITS_ETH_CONTRACT) {
      return;
    }
    const toWallet = normalizeAddress(transfer.to) === normalizedWallet;
    const fromWallet = normalizeAddress(transfer.from) === normalizedWallet;
    if (!toWallet && !fromWallet) {
      return;
    }

    const tokenId = (transfer.tokenID ?? '').trim();
    if (!tokenId) {
      return;
    }

    const current = map.get(contractAddress) ?? {
      symbol: transfer.tokenSymbol?.trim() || 'NFT',
      name: transfer.tokenName?.trim() || 'Unknown collection',
      tokenIds: new Set<string>()
    };

    if (toWallet) {
      current.tokenIds.add(tokenId);
    }
    if (fromWallet) {
      current.tokenIds.delete(tokenId);
    }

    map.set(contractAddress, current);
  });

  return Array.from(map.entries())
    .map(([contractAddress, value]) => ({
      contractAddress,
      symbol: value.symbol,
      name: value.name,
      balance: value.tokenIds.size,
      imageUrl: undefined
    }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.contractAddress.localeCompare(b.contractAddress));
};

const aggregateNftAssets = (transfers: BlockscoutNftTransfer[], walletAddress: string) => {
  const normalizedWallet = normalizeAddress(walletAddress);
  const sorted = [...transfers].sort((left, right) => {
    const blockDiff = Number(left.blockNumber ?? 0) - Number(right.blockNumber ?? 0);
    if (blockDiff !== 0) {
      return blockDiff;
    }
    const timeDiff = Number(left.timeStamp ?? 0) - Number(right.timeStamp ?? 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return (left.tokenID ?? '').localeCompare(right.tokenID ?? '');
  });

  const byContract = new Map<
    string,
    Map<
      string,
      {
        name: string;
        collectionName: string;
        symbol: string;
      }
    >
  >();

  sorted.forEach((transfer) => {
    const contractAddress = normalizeAddress(transfer.contractAddress);
    if (contractAddress === DIGIT_RABBITS_ETH_CONTRACT) {
      return;
    }
    if (!contractAddress || !isMegaEthAddress(contractAddress)) {
      return;
    }

    const tokenId = (transfer.tokenID ?? '').trim();
    if (!tokenId) {
      return;
    }

    const toWallet = normalizeAddress(transfer.to) === normalizedWallet;
    const fromWallet = normalizeAddress(transfer.from) === normalizedWallet;
    if (!toWallet && !fromWallet) {
      return;
    }

    const tokenMap = byContract.get(contractAddress) ?? new Map();

    if (toWallet) {
      const collectionName = transfer.tokenName?.trim() || 'Unknown collection';
      const symbol = transfer.tokenSymbol?.trim() || 'NFT';
      tokenMap.set(tokenId, {
        name: `${collectionName} #${tokenId}`,
        collectionName,
        symbol
      });
    }

    if (fromWallet) {
      tokenMap.delete(tokenId);
    }

    byContract.set(contractAddress, tokenMap);
  });

  const assets: WalletInsights['walletNftAssets'] = [];
  byContract.forEach((tokenMap, contractAddress) => {
    tokenMap.forEach((entry, tokenId) => {
      const projectId = resolveProjectIdFromNft(contractAddress, entry.collectionName, entry.name, entry.symbol);
      if (projectId && EXCLUDED_NFT_PROJECT_IDS.has(projectId)) {
        return;
      }
      assets.push({
        contractAddress,
        tokenId,
        name: entry.name,
        collectionName: entry.collectionName,
        imageUrl: undefined,
        projectId
      });
    });
  });

  return assets.sort(
    (a, b) => a.collectionName.localeCompare(b.collectionName) || a.tokenId.localeCompare(b.tokenId)
  );
};

const aggregateNftHoldings = (transfers: BlockscoutNftTransfer[], walletAddress: string) => {
  const normalizedWallet = normalizeAddress(walletAddress);
  const holdings = transfers.reduce<Record<string, number>>((acc, transfer) => {
    if (normalizeAddress(transfer.contractAddress) === DIGIT_RABBITS_ETH_CONTRACT) {
      return acc;
    }
    const projectId = NFT_CONTRACT_MAP[normalizeAddress(transfer.contractAddress)];
    if (projectId && EXCLUDED_NFT_PROJECT_IDS.has(projectId)) {
      return acc;
    }
    if (!projectId) {
      return acc;
    }
    const toWallet = normalizeAddress(transfer.to) === normalizedWallet;
    const fromWallet = normalizeAddress(transfer.from) === normalizedWallet;
    if (!toWallet && !fromWallet) {
      return acc;
    }
    const delta = toWallet ? 1 : -1;
    acc[projectId] = (acc[projectId] || 0) + delta;
    return acc;
  }, {});
  return Object.entries(holdings).reduce<Record<string, number>>((acc, [projectId, balance]) => {
    if (balance > 0) {
      acc[projectId] = balance;
    }
    return acc;
  }, {});
};

const aggregateNftAssetHoldings = (assets: WalletInsights['walletNftAssets']) => {
  return assets.reduce<Record<string, number>>((acc, asset) => {
    if (!asset.projectId) {
      return acc;
    }
    acc[asset.projectId] = (acc[asset.projectId] || 0) + 1;
    return acc;
  }, {});
};

const resolveWalletError = (cause: unknown) => {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return BLOCKSCOUT_GENERIC_ERROR;
};

export const useWalletInsights = (): WalletInsights => {
  const [walletInput, setWalletInput] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletUpdatedAt, setWalletUpdatedAt] = useState<number | null>(null);
  const [walletTransactionCount, setWalletTransactionCount] = useState(0);
  const [walletUniqueContractCount, setWalletUniqueContractCount] = useState(0);
  const [walletDiscoveredApps, setWalletDiscoveredApps] = useState<WalletInsights['walletDiscoveredApps']>([]);
  const [walletDexProtocols, setWalletDexProtocols] = useState<WalletInsights['walletDexProtocols']>([]);
  const [walletLpPositions, setWalletLpPositions] = useState<WalletInsights['walletLpPositions']>([]);
  const [walletNftCollections, setWalletNftCollections] = useState<WalletInsights['walletNftCollections']>([]);
  const [walletNftAssets, setWalletNftAssets] = useState<WalletInsights['walletNftAssets']>([]);
  const [walletInteractionCounts, setWalletInteractionCounts] = useState<Record<string, number>>({});
  const [walletNftHoldings, setWalletNftHoldings] = useState<Record<string, number>>({});
  const [contractDirectoryStatus, setContractDirectoryStatus] = useState<ContractDirectoryStatus>('idle');
  const requestRef = useRef(0);

  const fetchWalletInsights = useCallback(async (address: string) => {
    const normalizedAddress = normalizeAddress(address);
    const requestId = ++requestRef.current;
    setWalletStatus('loading');
    setContractDirectoryStatus('loading');
    setWalletError(null);
    setWalletUpdatedAt(null);
    setWalletTransactionCount(0);
    setWalletUniqueContractCount(0);
    setWalletDiscoveredApps([]);
    setWalletDexProtocols([]);
    setWalletLpPositions([]);
    setWalletNftCollections([]);
    setWalletNftAssets([]);
    setWalletInteractionCounts({});
    setWalletNftHoldings({});

    try {
      const [transactions, tokenTransfers, nftTransfers, internalTransactions] = await Promise.all([
        fetchLatestTransactions(normalizedAddress),
        fetchTokenTransfers(normalizedAddress),
        fetchNftTransfers(normalizedAddress),
        fetchInternalTransactions(normalizedAddress)
      ]);

      if (requestRef.current !== requestId) {
        return;
      }

      const counts = aggregateInteractionCounts(transactions);
      let nftCollections: WalletInsights['walletNftCollections'] = [];
      let nftAssets: WalletInsights['walletNftAssets'] = [];
      const explorerNftCollections = aggregateNftCollections(nftTransfers, normalizedAddress);
      const explorerNftAssets = aggregateNftAssets(nftTransfers, normalizedAddress);
      try {
        const openSeaData = await fetchOpenSeaNfts(normalizedAddress);
        nftCollections = openSeaData.collections;
        const openSeaImageByContract = new Map(
          openSeaData.collections.map((entry) => [normalizeAddress(entry.contractAddress), entry.imageUrl ?? undefined])
        );
        const openSeaImageByAssetKey = new Map<string, string | undefined>();
        openSeaData.assets.forEach((entry) => {
          const contract = normalizeAddress(entry.contractAddress);
          buildTokenIdCandidates(entry.tokenId).forEach((candidate) => {
            const key = `${contract}:${candidate}`;
            if (!openSeaImageByAssetKey.has(key)) {
              openSeaImageByAssetKey.set(key, entry.imageUrl ?? undefined);
            }
          });
        });

        nftAssets = explorerNftAssets
          .map((asset) => {
            const contract = normalizeAddress(asset.contractAddress);
            const imageFromToken = buildTokenIdCandidates(asset.tokenId)
              .map((candidate) => openSeaImageByAssetKey.get(`${contract}:${candidate}`))
              .find(Boolean);
            const imageFromCollection = openSeaImageByContract.get(normalizeAddress(asset.contractAddress));
            return {
              ...asset,
              imageUrl: imageFromToken || imageFromCollection || asset.imageUrl
            };
          })
          .filter((asset) => asset.projectId || normalizeAddress(asset.contractAddress) === BAD_BUNNZ_ETH_CONTRACT);

        const missingImageIndexes = nftAssets
          .map((asset, index) => ({ asset, index }))
          .filter(({ asset }) => !asset.imageUrl)
          .slice(0, 180);

        const chunkSize = 8;
        for (let index = 0; index < missingImageIndexes.length; index += chunkSize) {
          const chunk = missingImageIndexes.slice(index, index + chunkSize);
          const resolved = await Promise.all(
            chunk.map(async ({ asset }) => {
              const imageUrl = await fetchOpenSeaNftImageByToken(asset.contractAddress, asset.tokenId);
              return imageUrl;
            })
          );

          resolved.forEach((imageUrl, chunkIndex) => {
            if (!imageUrl) {
              return;
            }
            const target = chunk[chunkIndex];
            nftAssets[target.index] = {
              ...nftAssets[target.index],
              imageUrl
            };
          });
        }

        const openSeaBadBunnzAssets = openSeaData.assets.filter(
          (asset) => normalizeAddress(asset.contractAddress) === BAD_BUNNZ_ETH_CONTRACT
        );
        if (openSeaBadBunnzAssets.length) {
          const existingAssetKeys = new Set(
            nftAssets.map(
              (asset) => `${normalizeAddress(asset.contractAddress)}:${normalizeTokenId(asset.tokenId)}`
            )
          );
          openSeaBadBunnzAssets.forEach((asset) => {
            const key = `${normalizeAddress(asset.contractAddress)}:${normalizeTokenId(asset.tokenId)}`;
            if (!existingAssetKeys.has(key)) {
              nftAssets.push(asset);
              existingAssetKeys.add(key);
            }
          });
        }
      } catch {
        nftCollections = [];
        nftAssets = explorerNftAssets.filter(
          (asset) => asset.projectId || normalizeAddress(asset.contractAddress) === BAD_BUNNZ_ETH_CONTRACT
        );
      }
      const openseaImageByContract = new Map(
        nftCollections.map((entry) => [normalizeAddress(entry.contractAddress), entry.imageUrl ?? undefined])
      );
      const openseaImageByCollectionKey = new Map<string, string>();
      const openseaImageCandidates: Array<{ name: string; symbol: string; imageUrl: string }> = [];
      nftCollections.forEach((entry) => {
        const imageUrl = entry.imageUrl?.trim();
        if (!imageUrl) {
          return;
        }
        openseaImageCandidates.push({
          name: entry.name,
          symbol: entry.symbol,
          imageUrl
        });
        [normalizeCollectionKey(entry.name), normalizeCollectionKey(entry.symbol)]
          .filter(Boolean)
          .forEach((key) => {
            if (!openseaImageByCollectionKey.has(key)) {
              openseaImageByCollectionKey.set(key, imageUrl);
            }
          });
      });
      const openseaBadBunnz = nftCollections.find(
        (entry) => normalizeAddress(entry.contractAddress) === BAD_BUNNZ_ETH_CONTRACT
      );

      nftCollections = explorerNftCollections.map((entry) => ({
        ...entry,
        imageUrl:
          openseaImageByContract.get(normalizeAddress(entry.contractAddress)) ||
          resolveOpenSeaImageFromCandidates(entry, openseaImageByCollectionKey, openseaImageCandidates) ||
          entry.imageUrl
      }));

      if (openseaBadBunnz && openseaBadBunnz.balance > 0) {
        const existingIndex = nftCollections.findIndex(
          (entry) => normalizeAddress(entry.contractAddress) === BAD_BUNNZ_ETH_CONTRACT
        );

        if (existingIndex >= 0) {
          nftCollections[existingIndex] = {
            ...nftCollections[existingIndex],
            balance: nftCollections[existingIndex].balance + openseaBadBunnz.balance,
            imageUrl: nftCollections[existingIndex].imageUrl || openseaBadBunnz.imageUrl,
            name:
              nftCollections[existingIndex].name && nftCollections[existingIndex].name !== 'Unknown collection'
                ? nftCollections[existingIndex].name
                : openseaBadBunnz.name
          };
        } else {
          nftCollections.push({
            ...openseaBadBunnz,
            contractAddress: BAD_BUNNZ_ETH_CONTRACT,
            name: openseaBadBunnz.name || 'BadBunnz'
          });
        }
      }
      const discovered = aggregateDiscoveredApps(
        transactions,
        internalTransactions,
        tokenTransfers,
        nftCollections
      );
      const lpPositions = aggregateLpPositions(tokenTransfers, normalizedAddress);
      const nftHoldingsFromAssets = aggregateNftAssetHoldings(nftAssets);
      const nftHoldings =
        Object.keys(nftHoldingsFromAssets).length > 0
          ? nftHoldingsFromAssets
          : aggregateNftHoldings(nftTransfers, normalizedAddress);

      setWalletTransactionCount(transactions.length);
      setWalletUniqueContractCount(discovered.uniqueContractCount);
      setWalletDiscoveredApps(discovered.discoveredApps);
      setWalletDexProtocols(discovered.dexProtocols);
      setWalletLpPositions(lpPositions);
      setWalletNftCollections(nftCollections);
      setWalletNftAssets(nftAssets);
      setWalletInteractionCounts(counts);
      setWalletNftHoldings(nftHoldings);
      setWalletUpdatedAt(Date.now());
      setWalletStatus('ready');
      setContractDirectoryStatus('idle');
    } catch (error) {
      if (requestRef.current !== requestId) {
        return;
      }
      setWalletStatus('error');
      setContractDirectoryStatus('idle');
      setWalletError(resolveWalletError(error));
    }
  }, []);

  const submitWallet = useCallback(() => {
    const rawInput = walletInput.trim();
    if (!rawInput) {
      setWalletStatus('error');
      setWalletError(ADDRESS_REQUIRED_ERROR);
      setContractDirectoryStatus('idle');
      return;
    }
    const parsedAddress = extractMegaEthAddress(rawInput);
    if (!parsedAddress) {
      setWalletStatus('error');
      setWalletError(ADDRESS_INVALID_ERROR);
      setContractDirectoryStatus('idle');
      return;
    }
    setWalletAddress(parsedAddress);
    fetchWalletInsights(parsedAddress);
  }, [walletInput, fetchWalletInsights]);

  const refreshWalletInsights = useCallback(() => {
    if (!walletAddress) {
      return;
    }
    fetchWalletInsights(walletAddress);
  }, [walletAddress, fetchWalletInsights]);

  const clearWallet = useCallback(() => {
    requestRef.current += 1;
    setWalletInput('');
    setWalletAddress(null);
    setWalletStatus('idle');
    setWalletError(null);
    setWalletTransactionCount(0);
    setWalletUniqueContractCount(0);
    setWalletDiscoveredApps([]);
    setWalletDexProtocols([]);
    setWalletLpPositions([]);
    setWalletNftCollections([]);
    setWalletNftAssets([]);
    setWalletInteractionCounts({});
    setWalletNftHoldings({});
    setWalletUpdatedAt(null);
    setContractDirectoryStatus('idle');
  }, []);

  return {
    walletAddress,
    walletInput,
    walletStatus,
    walletError,
    walletTransactionCount,
    walletUniqueContractCount,
    walletDiscoveredApps,
    walletDexProtocols,
    walletLpPositions,
    walletNftCollections,
    walletNftAssets,
    walletInteractionCounts,
    walletNftHoldings,
    walletUpdatedAt,
    contractDirectoryStatus,
    setWalletInput,
    submitWallet,
    clearWallet,
    refreshWalletInsights
  };
};
