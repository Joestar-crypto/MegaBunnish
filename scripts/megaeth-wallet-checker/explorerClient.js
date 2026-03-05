import axios from 'axios';
import { CONFIG, EXPLORER_ACTIONS } from './config.js';
import { sleep, withRetries } from './helpers.js';

const normalizeResult = (payload) => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload.result)) {
    return payload.result;
  }
  return [];
};

const isSuccess = (payload) => {
  if (!payload) {
    return false;
  }

  const msg = String(payload.message ?? '').toLowerCase();
  if (msg.includes('no transactions found')) {
    return true;
  }

  if (payload.status === '1' || payload.status === 1) {
    return true;
  }

  // Some Blockscout responses omit status for account-style routes.
  return Array.isArray(payload.result);
};

class ExplorerHttp {
  constructor(baseUrl, apiKey = '') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.client = axios.create({ timeout: CONFIG.timeoutMs });
  }

  async fetchPage({ action, address, page }) {
    const params = {
      module: 'account',
      action,
      address,
      startblock: CONFIG.startBlock,
      endblock: CONFIG.endBlock,
      page,
      offset: CONFIG.pageSize,
      sort: 'asc'
    };

    if (this.apiKey) {
      params.apikey = this.apiKey;
    }

    const { data } = await this.client.get(this.baseUrl, { params });
    if (!isSuccess(data)) {
      throw new Error(`Explorer request failed for action=${action}`);
    }

    return normalizeResult(data);
  }

  async fetchAll(action, address) {
    const out = [];

    // Page through full history until explorer returns a short page or empty set.
    for (let page = 1; page <= CONFIG.maxPages; page += 1) {
      const chunk = await withRetries(
        () => this.fetchPage({ action, address, page }),
        CONFIG.maxRetries,
        CONFIG.requestDelayMs
      );

      if (!chunk.length) {
        break;
      }

      out.push(...chunk);

      if (chunk.length < CONFIG.pageSize) {
        break;
      }

      await sleep(CONFIG.requestDelayMs);
    }

    return out;
  }

  async fetchWalletStreams(address) {
    const txlist = await this.fetchAll(EXPLORER_ACTIONS.txlist, address);
    const txlistinternal = await this.fetchAll(EXPLORER_ACTIONS.txlistinternal, address);
    const tokentx = await this.fetchAll(EXPLORER_ACTIONS.tokentx, address);
    const tokennfttx = await this.fetchAll(EXPLORER_ACTIONS.tokennfttx, address);

    return { txlist, txlistinternal, tokentx, tokennfttx };
  }

  async healthcheck(address) {
    await this.fetchPage({ action: EXPLORER_ACTIONS.txlist, address, page: 1 });
  }
}

// Use Etherscan-compatible endpoint first, fallback to Blockscout endpoint when unavailable.
export const fetchWithFallback = async (address) => {
  const primary = new ExplorerHttp(CONFIG.etherscanApiUrl, CONFIG.explorerApiKey);

  try {
    await primary.healthcheck(address);
    const data = await primary.fetchWalletStreams(address);
    return { source: 'etherscan-compatible', warning: null, data };
  } catch (error) {
    const secondary = new ExplorerHttp(CONFIG.blockscoutApiUrl, CONFIG.explorerApiKey);
    await secondary.healthcheck(address);
    const data = await secondary.fetchWalletStreams(address);
    return {
      source: 'blockscout-fallback',
      warning: `Primary endpoint failed: ${error instanceof Error ? error.message : String(error)}`,
      data
    };
  }
};
