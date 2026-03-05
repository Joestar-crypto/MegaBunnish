import { ethers } from 'ethers';
import { CATEGORY } from './config.js';
import { KNOWN_METHODS } from './methodMap.js';
import { fetchWithFallback } from './explorerClient.js';
import { RpcClient } from './rpcClient.js';
import { uniqBy } from './helpers.js';

const methodIdFromInput = (input) => {
  if (!input || input === '0x' || input.length < 10) {
    return null;
  }
  return input.slice(0, 10).toLowerCase();
};

const classifyByEvents = (decodedLogs) => {
  if (!decodedLogs?.length) {
    return null;
  }

  const categories = new Set(decodedLogs.map((log) => log.category));

  if (categories.has(CATEGORY.nft)) {
    return CATEGORY.nft;
  }
  if (categories.has(CATEGORY.dex)) {
    return CATEGORY.dex;
  }
  if (categories.has(CATEGORY.token)) {
    return CATEGORY.token;
  }

  return null;
};

const classifyInteraction = ({ stream, methodId, decodedLogs, toIsContract }) => {
  if (stream === 'tokennfttx') {
    return CATEGORY.nft;
  }
  if (stream === 'tokentx') {
    return CATEGORY.token;
  }
  if (stream === 'txlistinternal') {
    return CATEGORY.internal;
  }

  if (methodId && KNOWN_METHODS[methodId]) {
    return KNOWN_METHODS[methodId].category;
  }

  const eventCategory = classifyByEvents(decodedLogs);
  if (eventCategory) {
    return eventCategory;
  }

  return toIsContract ? CATEGORY.otherContract : CATEGORY.transfer;
};

const normalizeRow = (stream, row) => ({
  stream,
  hash: (row.hash ?? row.transactionHash ?? '').toLowerCase() || null,
  blockNumber: Number(row.blockNumber ?? row.blocknumber ?? 0),
  timestamp: Number(row.timeStamp ?? row.timestamp ?? 0),
  from: row.from ? row.from.toLowerCase() : null,
  to: row.to ? row.to.toLowerCase() : null,
  value: row.value != null ? String(row.value) : null,
  input: row.input ?? null,
  contractAddress: row.contractAddress ? row.contractAddress.toLowerCase() : null,
  tokenSymbol: row.tokenSymbol ?? null,
  tokenName: row.tokenName ?? null,
  tokenId: row.tokenID ?? null
});

export const analyzeWallet = async (walletAddress) => {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  const wallet = walletAddress.toLowerCase();
  const rpc = new RpcClient();

  // Pull all supported account streams from explorer API(s).
  const explorerData = await fetchWithFallback(wallet);
  const { txlist, txlistinternal, tokentx, tokennfttx } = explorerData.data;

  // Flatten everything into one normalized interaction candidate list.
  const rawInteractions = [
    ...txlist.map((row) => normalizeRow('txlist', row)),
    ...txlistinternal.map((row) => normalizeRow('txlistinternal', row)),
    ...tokentx.map((row) => normalizeRow('tokentx', row)),
    ...tokennfttx.map((row) => normalizeRow('tokennfttx', row))
  ];

  // Deduplicate by stream + tx hash + block to avoid explorer duplicates.
  const interactions = uniqBy(rawInteractions, (item) => `${item.stream}:${item.hash}:${item.blockNumber}`);

  const enriched = [];

  // Enrich each interaction with methodId, contract check and decoded logs.
  for (const row of interactions) {
    const methodId = methodIdFromInput(row.input);

    // Detect contract interaction by 'to' and token contract address.
    const toIsContract = row.to ? await rpc.isContract(row.to) : false;
    const tokenContractIsContract = row.contractAddress ? await rpc.isContract(row.contractAddress) : false;

    // Decode logs when tx hash exists; cached in RpcClient to avoid duplicated calls.
    const decodedLogs = row.hash ? await rpc.getDecodedLogs(row.hash) : [];

    const methodMeta = methodId ? KNOWN_METHODS[methodId] ?? null : null;

    const interactionType = classifyInteraction({
      stream: row.stream,
      methodId,
      decodedLogs,
      toIsContract: toIsContract || tokenContractIsContract
    });

    enriched.push({
      stream: row.stream,
      hash: row.hash,
      blockNumber: row.blockNumber,
      timestamp: row.timestamp,
      from: row.from,
      to: row.to,
      contractAddress: row.contractAddress,
      toIsContract,
      tokenContractIsContract,
      methodId,
      methodName: methodMeta?.name ?? null,
      interactionType,
      tokenSymbol: row.tokenSymbol,
      tokenName: row.tokenName,
      tokenId: row.tokenId,
      decodedLogs
    });
  }

  // Count unique contracts from both call targets and token contracts.
  const uniqueContracts = new Set();
  for (const row of enriched) {
    if (row.to && row.toIsContract) {
      uniqueContracts.add(row.to);
    }
    if (row.contractAddress && row.tokenContractIsContract) {
      uniqueContracts.add(row.contractAddress);
    }
  }

  const breakdownByType = enriched.reduce((acc, row) => {
    acc[row.interactionType] = (acc[row.interactionType] ?? 0) + 1;
    return acc;
  }, {});

  return {
    wallet,
    explorerSource: explorerData.source,
    warning: explorerData.warning,
    totalTransactions: enriched.length,
    uniqueContractsInteracted: uniqueContracts.size,
    breakdownByType,
    interactions: enriched
  };
};
