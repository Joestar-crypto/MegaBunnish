import { ethers } from 'ethers';
import { CATEGORY } from './config.js';

// Minimal interfaces for decoding common interaction logs.
const ERC20_721 = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
]);

const ERC1155 = new ethers.Interface([
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);

const DEX = new ethers.Interface([
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event Mint(address indexed sender, uint amount0, uint amount1)',
  'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)'
]);

const CANDIDATES = [
  { iface: ERC20_721, category: CATEGORY.token },
  { iface: ERC1155, category: CATEGORY.nft },
  { iface: DEX, category: CATEGORY.dex }
];

const normalize = (value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
};

// Decode a single log against known interfaces.
export const decodeEventLog = (log) => {
  for (const { iface, category } of CANDIDATES) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) {
        continue;
      }

      const args = Object.fromEntries(
        parsed.fragment.inputs.map((input, index) => [input.name || `arg${index}`, normalize(parsed.args[index])])
      );

      return {
        eventName: parsed.name,
        signature: parsed.signature,
        category,
        args
      };
    } catch {
      // Keep trying other interfaces.
    }
  }

  return {
    eventName: 'Unknown',
    signature: log.topics?.[0] ?? null,
    category: CATEGORY.unknown,
    args: {}
  };
};
