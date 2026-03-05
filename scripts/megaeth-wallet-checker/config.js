import 'dotenv/config';

// Centralized runtime configuration.
// All values can be overridden via environment variables.
export const CONFIG = {
  rpcUrl: process.env.MEGAETH_RPC_URL ?? 'https://carrot.megaeth.com/rpc',

  // Primary explorer endpoint (Etherscan-compatible).
  etherscanApiUrl: process.env.MEGAETH_ETHERSCAN_API_URL ?? 'https://megaeth.blockscout.com/api',

  // Fallback explorer endpoint (Blockscout-compatible).
  blockscoutApiUrl: process.env.MEGAETH_BLOCKSCOUT_API_URL ?? 'https://megaeth.blockscout.com/api',

  explorerApiKey: process.env.MEGAETH_EXPLORER_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? '',

  startBlock: Number(process.env.MEGAETH_START_BLOCK ?? 0),
  endBlock: Number(process.env.MEGAETH_END_BLOCK ?? 99999999),
  pageSize: Number(process.env.MEGAETH_PAGE_SIZE ?? 100),
  maxPages: Number(process.env.MEGAETH_MAX_PAGES ?? 500),

  // Request control / resilience.
  requestDelayMs: Number(process.env.MEGAETH_REQUEST_DELAY_MS ?? 200),
  maxRetries: Number(process.env.MEGAETH_MAX_RETRIES ?? 5),
  timeoutMs: Number(process.env.MEGAETH_TIMEOUT_MS ?? 30000)
};

export const EXPLORER_ACTIONS = {
  txlist: 'txlist',
  txlistinternal: 'txlistinternal',
  tokentx: 'tokentx',
  tokennfttx: 'tokennfttx'
};

export const CATEGORY = {
  dex: 'DEX',
  lending: 'Lending',
  nft: 'NFT',
  token: 'Token',
  internal: 'Internal',
  otherContract: 'Other Contract',
  transfer: 'EOA Transfer',
  unknown: 'Unknown'
};
