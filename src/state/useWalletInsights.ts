import { useCallback, useRef, useState } from 'react';
import { INTERACTION_CONTRACT_MAP, NFT_CONTRACT_MAP } from '../data/contractDirectory';

export type WalletStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ContractDirectoryStatus = 'idle' | 'loading' | 'error';

export type WalletInsights = {
  walletAddress: string | null;
  walletInput: string;
  walletStatus: WalletStatus;
  walletError: string | null;
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
};

const BLOCKSCOUT_API_URL = 'https://megaeth.blockscout.com/api';
const BLOCKSCOUT_V2_API_URL = 'https://megaeth.blockscout.com/api/v2';
const BLOCKSCOUT_API_KEY = (import.meta.env.VITE_ETHERSCAN_API_KEY || 'YourApiKeyToken').trim();
const ADDRESS_REQUIRED_ERROR = 'MegaETH address required';
const ADDRESS_INVALID_ERROR = 'Invalid MegaETH address';
const BLOCKSCOUT_GENERIC_ERROR = 'Unable to reach Blockscout. Try again later.';
const NFT_PAGE_SIZE = '120';
const MAX_TRANSACTION_PAGES = 5;
const MAX_TRANSACTION_RESULTS = 250;

const normalizeAddress = (value: string) => value.trim().toLowerCase();
const isMegaEthAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());

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

  if (message.includes('no transactions') || message.includes('no token transfers')) {
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

const fetchLatestTransactions = async (address: string) => {
  const collected: BlockscoutTransaction[] = [];
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
    const mapped = (payload.items ?? []).map(mapV2Transaction).filter(Boolean) as BlockscoutTransaction[];
    if (!mapped.length) {
      break;
    }

    collected.push(...mapped);
    pageParams = sanitizeNextPageParams(payload.next_page_params);

    if (!pageParams) {
      break;
    }
  }

  return collected.slice(0, MAX_TRANSACTION_RESULTS);
};

const fetchTrackedNftTransfers = (address: string) =>
  fetchBlockscoutArray<BlockscoutNftTransfer>({
    module: 'account',
    action: 'tokennfttx',
    address,
    sort: 'desc',
    page: '1',
    offset: NFT_PAGE_SIZE
  });

const aggregateInteractionCounts = (transactions: BlockscoutTransaction[]) => {
  return transactions.reduce<Record<string, number>>((acc, tx) => {
    if (tx.isError === '1' || !tx.to) {
      return acc;
    }
    const projectId = INTERACTION_CONTRACT_MAP[normalizeAddress(tx.to)];
    if (!projectId) {
      return acc;
    }
    acc[projectId] = (acc[projectId] || 0) + 1;
    return acc;
  }, {});
};

const aggregateNftHoldings = (transfers: BlockscoutNftTransfer[], walletAddress: string) => {
  const normalizedWallet = normalizeAddress(walletAddress);
  const holdings = transfers.reduce<Record<string, number>>((acc, transfer) => {
    const projectId = NFT_CONTRACT_MAP[normalizeAddress(transfer.contractAddress)];
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
    setWalletInteractionCounts({});
    setWalletNftHoldings({});

    try {
      const [transactions, nftTransfers] = await Promise.all([
        fetchLatestTransactions(normalizedAddress),
        fetchTrackedNftTransfers(normalizedAddress)
      ]);

      if (requestRef.current !== requestId) {
        return;
      }

      const counts = aggregateInteractionCounts(transactions);
      const nftHoldings = aggregateNftHoldings(nftTransfers, normalizedAddress);

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
    if (!isMegaEthAddress(rawInput)) {
      setWalletStatus('error');
      setWalletError(ADDRESS_INVALID_ERROR);
      setContractDirectoryStatus('idle');
      return;
    }
    const normalizedAddress = normalizeAddress(rawInput);
    setWalletAddress(normalizedAddress);
    fetchWalletInsights(normalizedAddress);
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
