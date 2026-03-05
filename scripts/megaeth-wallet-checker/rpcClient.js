import { ethers } from 'ethers';
import { CONFIG } from './config.js';
import { withRetries } from './helpers.js';
import { decodeEventLog } from './events.js';

export class RpcClient {
  constructor(rpcUrl = CONFIG.rpcUrl) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contractCodeCache = new Map();
    this.receiptCache = new Map();
  }

  // Detect if an address is a contract via eth_getCode.
  async isContract(address) {
    if (!address || !ethers.isAddress(address)) {
      return false;
    }

    const key = address.toLowerCase();
    if (this.contractCodeCache.has(key)) {
      return this.contractCodeCache.get(key);
    }

    const code = await withRetries(() => this.provider.getCode(address), CONFIG.maxRetries, CONFIG.requestDelayMs);
    const isContract = Boolean(code && code !== '0x');

    this.contractCodeCache.set(key, isContract);
    return isContract;
  }

  // Fetch and decode logs for one tx hash.
  async getDecodedLogs(txHash) {
    if (!txHash) {
      return [];
    }

    const key = txHash.toLowerCase();
    if (this.receiptCache.has(key)) {
      return this.receiptCache.get(key);
    }

    const receipt = await withRetries(
      () => this.provider.getTransactionReceipt(txHash),
      CONFIG.maxRetries,
      CONFIG.requestDelayMs
    );

    if (!receipt?.logs?.length) {
      this.receiptCache.set(key, []);
      return [];
    }

    const decoded = receipt.logs.map((log) => ({
      address: log.address?.toLowerCase(),
      topics: log.topics,
      data: log.data,
      ...decodeEventLog(log)
    }));

    this.receiptCache.set(key, decoded);
    return decoded;
  }
}
